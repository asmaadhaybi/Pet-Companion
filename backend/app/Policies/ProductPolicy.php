<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ProductPolicy
{
    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        // ✅ THIS IS THE CORRECT PLACE FOR THE LOGIC
        return $user->role === 'admin' || $user->role === 'super_admin';
    }

    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        // For now, we can say anyone can view the list of products
        // Or apply your admin logic here if needed for other parts of the app
        return true; 
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Product $product): bool
    {
        // For now, we can say anyone can view a single product
        return true;
    }


    // You can leave the other functions empty for now
    // ... update, delete, etc. ...
    
    public function update(User $user, Product $product): bool
    {
        return $user->role === 'admin' || $user->role === 'super_admin';
    }
 
    public function delete(User $user, Product $product): bool
    {
        return $user->role === 'super_admin';
    }
}