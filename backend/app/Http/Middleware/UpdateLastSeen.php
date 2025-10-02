<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class UpdateLastSeen
{
    public function handle(Request $request, Closure $next): Response
    {
        // Check if a user is authenticated
        if (Auth::check()) {
            // Update the last_seen_at timestamp for the current user
            Auth::user()->update(['last_seen_at' => now()]);
        }

        // Allow the request to continue
        return $next($request);
    }
}