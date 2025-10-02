<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

 class CheckRole{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @param  string  $role
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    // public function handle(Request $request, Closure $next, $role)
    // {
    //     if (!Auth::check()) {
    //         return response()->json([
    //             'status' => 'error',
    //             'message' => 'Unauthorized'
    //         ], 401);
    //     }

    //     $user = Auth::user();
        
    //     // Check if user has required role
    //     if (!$this->hasRequiredRole($user, $role)) {
    //         return response()->json([
    //             'status' => 'error',
    //             'message' => 'Access denied. Insufficient permissions.'
    //         ], 403);
    //     }

    //     return $next($request);
    // }
// Use `...$roles` to capture all parameters
public function handle(Request $request, Closure $next, ...$roles)
{
    if (!Auth::check()) {
        return response()->json(['message' => 'Unauthenticated.'], 401);
    }

    $user = Auth::user();

    // Loop through the roles from the route and check if the user has any of them
    foreach ($roles as $role) {
        if ($user->hasRole($role)) {
            return $next($request); // Allow access if any role matches
        }
    }

    return response()->json(['message' => 'Access denied.'], 403);
}
 
    /**
     * Check if user has required role
     */
    private function hasRequiredRole($user, $requiredRole)
    {
        switch ($requiredRole) {
            case 'super_admin':
                return $user->isSuperAdmin();
            
            case 'admin':
                return $user->isAdmin(); // This includes both admin and super_admin
            
            case 'user':
                return true; // All authenticated users can access user routes
            
            default:
                return $user->hasRole($requiredRole);
        }
    }
}