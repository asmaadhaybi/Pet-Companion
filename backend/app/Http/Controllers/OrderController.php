<?php

// app/Http/Controllers/OrderController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\UserPoints;
use Exception; // It's good practice to import the base Exception class


class OrderController extends Controller
{
    // public function __construct()
    // {
    //     $this->middleware('auth:api');
    // }

   public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'shipping_address' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $validator->errors()], 422);
        }

        try {
            // DB::transaction will automatically roll back everything if an error occurs.
            $order = DB::transaction(function () use ($request) {
                $user = Auth::user();

                // The Order model will automatically generate the order_number on creation
                $order = Order::create([
                    'user_id' => $user->id,
                    'total_amount' => 0, // Placeholder, will be updated later
                    'shipping_address' => $request->shipping_address,
                ]);

                $subtotal = 0;

                foreach ($request->items as $itemData) {
                    $product = Product::find($itemData['product_id']);

                    if (!$product) {
                        throw new \Exception("A product in your cart is no longer available.");
                    }

                    if ($product->stock_quantity < $itemData['quantity']) {
                        throw new \Exception("Insufficient stock for {$product->name}.");
                    }

                    $itemTotal = $product->price * $itemData['quantity'];
                    $subtotal += $itemTotal;

                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $product->id,
                        'quantity' => $itemData['quantity'],
                        'unit_price' => $product->price,
                        'total_price' => $itemTotal,
                    ]);

                    $product->decrementStock($itemData['quantity']);
                }

                // Calculate final totals
                $shippingAmount = $subtotal >= 100 ? 0 : 9.99;
                $taxAmount = $subtotal * 0.08;
                $totalAmount = $subtotal + $shippingAmount + $taxAmount;
                
                // ✅ START: MODIFIED POINTS AWARD LOGIC
                $pointsToAward = 0; // Initialize points to award

                if ($totalAmount >= 100) {
                    // Calculate 25% of the total, rounded down
                    $pointsToAward = floor($totalAmount * 0.25);

                    // Find the user's single points record, or create it if it doesn't exist
                    $userPoints = UserPoints::firstOrCreate(
                        ['user_id' => $user->id],
                        ['points' => 0] // Default to 0 points if this is a new record
                    );

                    // Add the new points to the existing total by incrementing the value
                    $userPoints->increment('points', $pointsToAward);
                }
                // ✅ END: MODIFIED POINTS AWARD LOGIC

                // Update the order with all final calculated values
                $order->update([
                    'total_amount'    => $totalAmount,
                    'shipping_amount' => $shippingAmount,
                    'tax_amount'      => $taxAmount,
                    'points_earned'   => $pointsToAward,
                ]);

                return $order;
            });

            // Return the fresh order data with a 200 OK status for client compatibility
            return response()->json(['success' => true, 'message' => 'Order placed successfully!', 'data' => $order->fresh()->load('orderItems.product')], 200);

        } catch (\Exception $e) {
            // Catch any exception and return a clear error message.
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function index()
    {
        try {
            $orders = Order::where('user_id', Auth::id())
                ->with(['orderItems.product'])
                ->orderBy('created_at', 'desc')
                ->paginate(10);

            return response()->json([
                'status' => 'success',
                'success' => true,
                'data' => $orders
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to fetch orders'
            ], 500);
        }
    }

    public function show($id)
    {
        try {
            $order = Order::where('user_id', Auth::id())
                ->with(['orderItems.product'])
                ->findOrFail($id);

            return response()->json([
                'status' => 'success',
                'success' => true,
                'data' => $order
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Order not found'
            ], 404);
        }
    }


   
// In app/Http/Controllers/OrderController.php

public function adminIndex()
{
    try {
        $orders = \App\Models\Order::with(['orderItems.product', 'user'])
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        // ✅ THIS IS THE CORRECTED LINE. 
        // It uses response()->json() to create a valid response.
        return response()->json([
            'success' => true,
            'orders' => $orders
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'An error occurred on the server.',
            'error' => $e->getMessage()
        ], 500);
    }
}
    /**
     * ✅ [ADMIN] Update the status of a specific order.
     */
    public function updateStatus(Request $request, $id)
    {
        // The role check is handled by middleware.
        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:pending,confirmed,shipped,delivered,cancelled'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid status provided.',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $order = Order::findOrFail($id);
            $order->status = $request->status;
            $order->save();

            return response()->json([
                'success' => true,
                'message' => 'Order status updated successfully!',
                'order' => $order
            ]);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found or could not be updated.',
                'error' => $e->getMessage()
            ], 404);
        }
    }
    /**
     * ✅ ADD THIS NEW FUNCTION
     * [ADMIN] Display the specified order.
     */
    public function adminShow($id)
    {
        try {
            // Find the order by its ID and include related user and product info
            // Note: We do NOT check for the user_id, so an admin can see any order.
            $order = \App\Models\Order::with(['orderItems.product', 'user'])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $order
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found.'
            ], 404);
        }
    }
}