<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Auth;

class AdminMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        // Check if the user is authenticated and has the correct role
        if (Auth::check() && in_array(Auth::user()->role, ['admin', 'super_admin'])) {
            // If they are an admin, allow the request to continue
            return $next($request);
        }

        // If not, return an unauthorized error
        return response()->json([
            'success' => false,
            'message' => 'Unauthorized. You do not have admin privileges.'
        ], 403); // 403 Forbidden status code
    }
}
