<?php
// app/Http/Controllers/ProductController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Models\Product;

class ProductController extends Controller
{
    public function __construct()
    {
         $this->middleware('auth:api');
                //$this->middleware('auth:api')->except(['index', 'show', 'getTiers']);

    }

    public function index(Request $request)
    {
        try {
            $query = Product::active()->with('creator:id,name');
            
            // Filter by tier
            if ($request->has('tier') && $request->tier !== 'all') {
                $query->where('tier', $request->tier);
            }
            
            // Filter by category
            if ($request->has('category') && $request->category) {
                $query->where('category', $request->category);
            }
            
            // Search by name or description
            if ($request->has('search') && $request->search) {
                $query->where(function($q) use ($request) {
                    $q->where('name', 'like', '%' . $request->search . '%')
                      ->orWhere('description', 'like', '%' . $request->search . '%');
                });
            }
            
            // Featured products first
            if ($request->has('featured') && $request->featured) {
                $query->featured();
            }
            
            // Sort options
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            
            switch ($sortBy) {
                case 'price':
                    $query->orderBy('price', $sortOrder);
                    break;
                case 'rating':
                    $query->orderBy('rating', $sortOrder);
                    break;
                case 'points':
                    $query->orderBy('points_required', $sortOrder);
                    break;
                default:
                    $query->orderBy('created_at', $sortOrder);
            }
            
            $products = $query->paginate(12);
            
            return response()->json([
                'status' => 'success',
                'success' => true,
                'data' => $products
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to fetch products',
                'error' => $e->getMessage()
            ], 500);
        }
    }

public function store(Request $request)
{
    try {
                $this->authorize('create', Product::class);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric|min:0',
            'original_price' => 'nullable|numeric|min:0',
            'stock_quantity' => 'required|integer|min:0',
            'tier' => 'required|in:automated,intelligent,luxury',
            'category' => 'required|string|max:100',
            // --- CHANGE 1: VALIDATE FOR IMAGE FILES ---
            'images' => 'required|array|min:1',
            'images.*' => 'image|mimes:jpeg,png,jpg,gif|max:2048', // Validate each item as an image file
            // --- END CHANGE ---
            'features' => 'required|array|min:1',
            'features.*' => 'string',
            'points_required' => 'integer|min:0',
            'discount_percentage' => 'numeric|min:0|max:100',
            'is_featured' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // --- CHANGE 2: HANDLE FILE UPLOADS ---
        $imagePaths = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $file) {
                // Store the file in 'public/product_images' and get the path
                $path = $file->store('product_images', 'public');
                // We store the full URL for easy access on the frontend
                $imagePaths[] = asset('storage/' . $path);
            }
        }
        // --- END CHANGE ---

        $product = Product::create([
            'name' => $request->name,
            'description' => $request->description,
            'price' => $request->price,
            'original_price' => $request->original_price,
            'stock_quantity' => $request->stock_quantity,
            'tier' => $request->tier,
            'category' => $request->category,
            // --- CHANGE 3: SAVE THE NEW IMAGE PATHS ---
            'images' => $imagePaths,
            // --- END CHANGE ---
            'features' => $request->features,
            'points_required' => $request->points_required ?: 0,
            'discount_percentage' => $request->discount_percentage ?: 0,
            'is_featured' => $request->is_featured ?: false,
            'created_by' => Auth::id(),
        ]);

        return response()->json([
            'status' => 'success',
            'success' => true,
            'message' => 'Product created successfully',
            'data' => $product->load('creator:id,name')
        ], 201);

    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'success' => false,
            'message' => 'Failed to create product',
            'error' => $e->getMessage()
        ], 500);
    }
}
    public function show($id)
    {
        try {
            $product = Product::with('creator:id,name')->findOrFail($id);
            
            return response()->json([
                'status' => 'success',
                'success' => true,
                'data' => $product
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Product not found'
            ], 404);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $product = Product::findOrFail($id);
            
            if (!Auth::user()->canManageProducts()) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Unauthorized. Only admins can update products.'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'name' => 'sometimes|string|max:255',
                'description' => 'sometimes|string',
                'price' => 'sometimes|numeric|min:0',
                'original_price' => 'nullable|numeric|min:0',
                'stock_quantity' => 'sometimes|integer|min:0',
                'tier' => 'sometimes|in:automated,intelligent,luxury',
                'category' => 'sometimes|string|max:100',
                'images' => 'nullable|array',
                'images.*' => 'string|url',
                'features' => 'nullable|array',
                'features.*' => 'string',
                'is_active' => 'sometimes|boolean',
                'is_featured' => 'sometimes|boolean',
                'points_required' => 'sometimes|integer|min:0',
                'discount_percentage' => 'sometimes|numeric|min:0|max:100',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $product->update($request->only([
                'name', 'description', 'price', 'original_price', 'stock_quantity', 
                'tier', 'category', 'images', 'features', 'is_active', 'is_featured',
                'points_required', 'discount_percentage'
            ]));

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'Product updated successfully',
                'data' => $product->load('creator:id,name')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to update product',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $product = Product::findOrFail($id);
            
            if (!Auth::user()->canManageProducts()) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Unauthorized. Only admins can delete products.'
                ], 403);
            }

            $product->delete();

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'Product deleted successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to delete product',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getTiers()
    {
        return response()->json([
            'status' => 'success',
            'success' => true,
            'data' => Product::TIERS
        ]);
    }
}