<?php
// app/Http/Controllers/CartController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\UserPoints;

class CartController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:api');
    }

 /**
     * ✅ REPLACE your existing index function with this more robust version.
     */
    public function index()
    {
        try {
            $userId = Auth::id();

            // --- STEP 1: Find and Delete Invalid Items ---
            // Get all cart items for the user, including those with broken product links.
            $allItems = CartItem::where('user_id', $userId)->with('product')->get();

            foreach ($allItems as $item) {
                // If the product relationship is null (because the product was deleted),
                // then this cart item is invalid and must be deleted.
                if (is_null($item->product)) {
                    $item->delete();
                }
            }

            // --- STEP 2: Fetch the Clean Cart Data ---
            // Now that invalid items are gone, we fetch the clean list from the database.
            $cartItems = CartItem::where('user_id', $userId)
                ->with(['product' => function($query) {
                    $query->select('id', 'name', 'price', 'original_price', 'tier', 'category', 'images', 'points_required', 'discount_percentage', 'stock_quantity');
                }])
                ->get();

            // --- STEP 3: Proceed with Calculations on the Clean Data ---
            $userPoints = Auth::user()->getCurrentPointsBalance();
            $subtotal = 0;
            $totalItems = 0;
            $totalDiscount = 0;

            foreach ($cartItems as $item) {
                $itemTotal = $item->getTotalPrice($userPoints);
                $subtotal += $itemTotal;
                $totalItems += $item->quantity;
                
                if ($item->use_points && $item->product->canUsePointsDiscount($userPoints)) {
                    $originalTotal = $item->product->price * $item->quantity;
                    $totalDiscount += ($originalTotal - $itemTotal);
                }
            }

            $shippingAmount = $subtotal >= 100 ? 0 : 9.99;
            $taxAmount = $subtotal * 0.08;
            $totalAmount = $subtotal + $shippingAmount + $taxAmount;

            return response()->json([
                'status' => 'success',
                'success' => true,
                'data' => [
                    'items' => $cartItems,
                    'subtotal' => round($subtotal, 2),
                    'total_items' => $totalItems,
                    // ... (the rest of the response is the same)
                    'total_amount' => round($totalAmount, 2),
                    'user_points' => $userPoints,
                    'free_shipping' => $subtotal >= 100
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to fetch cart',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'product_id' => 'required|exists:products,id',
                'quantity' => 'required|integer|min:1',
                'use_points' => 'boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $product = Product::findOrFail($request->product_id);

            if (!$product->isInStock()) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Product is out of stock'
                ], 400);
            }

            if ($product->stock_quantity < $request->quantity) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Not enough stock available'
                ], 400);
            }

            $cartItem = CartItem::updateOrCreate(
                [
                    'user_id' => Auth::id(),
                    'product_id' => $request->product_id
                ],
                [
                    'quantity' => $request->quantity,
                    'use_points' => $request->use_points ?? false
                ]
            );

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'Item added to cart successfully',
                'data' => $cartItem->load('product')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to add item to cart',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $cartItem = CartItem::where('user_id', Auth::id())->findOrFail($id);

            $validator = Validator::make($request->all(), [
                'quantity' => 'sometimes|integer|min:1',
                'use_points' => 'sometimes|boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            if ($request->has('quantity') && $cartItem->product->stock_quantity < $request->quantity) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Not enough stock available'
                ], 400);
            }

            $cartItem->update($request->only(['quantity', 'use_points']));

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'Cart item updated successfully',
                'data' => $cartItem->load('product')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to update cart item',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $cartItem = CartItem::where('user_id', Auth::id())->findOrFail($id);
            $cartItem->delete();

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'Item removed from cart successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to remove item from cart',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function clear()
    {
        try {
            CartItem::where('user_id', Auth::id())->delete();

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'Cart cleared successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to clear cart',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
