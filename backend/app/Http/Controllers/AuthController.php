<?php

namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use App\Models\User;

class AuthController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:api', ['except' => ['login', 'register', 'forgotPassword', 'resetPassword']]);
    }

    public function login(Request $request)
    { 
        try {
            $request->validate([
                'email' => 'required|string|email',
                'password' => 'required|string',
            ]);
            
            $credentials = $request->only('email', 'password');

            $token = Auth::attempt($credentials);
            if (!$token) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Invalid credentials',
                ], 401);
            }

            $user = Auth::user();
            
            // Get user profile with pet information
            $userProfile = $user->getProfileWithPets();

            return response()->json([
                'status' => 'success',
                'success' => true,
                'user' => $userProfile,
                'authorisation' => [
                    'token' => $token,
                    'type' => 'bearer',
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'An error occurred during login',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function register(Request $request)
    {
        try {
            $request->validate([
                'name' => 'required|string|max:255',
                'email' => 'required|string|email|max:255|unique:users',
                'password' => 'required|string|min:6',
                'role' => 'sometimes|in:user,admin,super_admin'
            ]);

            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => $request->input('role', 'user'),
            ]);

            $token = Auth::login($user);

            // Get user profile with pet information (will be null for new users)
            $userProfile = $user->getProfileWithPets();

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'User created successfully',
                'user' => $userProfile,
                'authorisation' => [
                    'token' => $token,
                    'type' => 'bearer',
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'An error occurred during registration',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function forgotPassword(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'email' => 'required|email'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = User::where('email', $request->email)->first();
            
            if (!$user) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'If an account with that email exists, we have sent a password reset link.'
                ], 404);
            }

            $resetToken = $user->generateResetToken();

            // For testing purposes, return the token in response
            // In production, you should send this via email
            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'Password reset token generated successfully',
                'reset_token' => $resetToken, // Remove this in production
                'email' => $user->email // Remove this in production
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'An error occurred while processing forgot password',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function resetPassword(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'email' => 'required|email',
                'token' => 'required|string',
                'password' => 'required|string|min:6|confirmed',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = User::where('email', $request->email)->first();

            if (!$user) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            if (!$user->isValidResetToken($request->token)) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Invalid or expired reset token'
                ], 400);
            }

            // Update password and clear reset token
            $user->password = Hash::make($request->password);
            $user->save(); // Important: Save the password first
            $user->clearResetToken(); // Then clear the reset token

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'Password reset successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'An error occurred while resetting password',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function logout()
    {
        Auth::logout();
        return response()->json([
            'status' => 'success',
            'success' => true,
            'message' => 'Successfully logged out',
        ]);
    }

    public function refresh()
    {
        $user = Auth::user();
        $userProfile = $user->getProfileWithPets();
        
        return response()->json([
            'status' => 'success',
            'success' => true,
            'user' => $userProfile,
            'authorisation' => [
                'token' => Auth::refresh(),
                'type' => 'bearer',
            ]
        ]);
    }

    public function me()
    {
        $user = Auth::user();
        $userProfile = $user->getProfileWithPets();
        
        return response()->json([
            'status' => 'success',
            'success' => true,
            'user' => $userProfile
        ]);
    }

    /**
     * Get user profile with complete pet information
     */
    public function getProfile()
    {
        try {
            $user = Auth::user();
            $userProfile = $user->getProfileWithPets();
            
            return response()->json([
                'status' => 'success',
                'success' => true,
                'user' => $userProfile,
                'message' => 'Profile retrieved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to retrieve profile',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    public function updateProfile(Request $request)
{
    try {
        $user = Auth::user();
        
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|string|email|max:255|unique:users,email,' . $user->id,
            'preferences' => 'sometimes|json'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Update basic profile information
        if ($request->has('name')) {
            $user->name = $request->name;
        }
        
        if ($request->has('email')) {
            $user->email = $request->email;
        }

        // Handle preferences
        if ($request->has('preferences')) {
            $preferences = json_decode($request->preferences, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $user->preferences = $preferences;
            }
        }

        $user->save();

        // Get updated profile with pets
        $userProfile = $user->getProfileWithPets();

        return response()->json([
            'status' => 'success',
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => $userProfile
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'success' => false,
            'message' => 'Failed to update profile',
            'error' => $e->getMessage()
        ], 500);
    }
}

/**
 * Upload profile image
 */
public function uploadProfileImage(Request $request)
{
        \Log::info('--- PROFILE IMAGE UPLOAD REQUEST RECEIVED ---'); // ✅ ADD THIS LINE

    try {
        $validator = Validator::make($request->all(), [
            'profile_image' => 'required|image|mimes:jpeg,png,jpg,gif|max:5120' // 5MB max
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();

        if ($request->hasFile('profile_image')) {
            $image = $request->file('profile_image');
            
            // Delete old profile image if exists
            if ($user->profile_picture) {
                $oldImagePath = public_path('storage/' . $user->profile_picture);
                if (file_exists($oldImagePath)) {
                    unlink($oldImagePath);
                }
            }

            // Generate unique filename
            $filename = 'profile_' . $user->id . '_' . time() . '.' . $image->getClientOriginalExtension();
            
            // Store in storage/app/public/profile_images
            $path = $image->storeAs('profile_images', $filename, 'public');
            
            // Update user profile picture path
            $user->profile_picture = $path;
            $user->save();

            // Generate full URL for the image
            $imageUrl = url('storage/' . $path);

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'Profile image uploaded successfully',
                'data' => [
                    'profile_picture' => $path,
                    'profile_picture_url' => $imageUrl,
                    'url' => $imageUrl
                ]
            ]);

        } else {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'No image file provided'
            ], 400);
        }

    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'success' => false,
            'message' => 'Failed to upload profile image',
            'error' => $e->getMessage()
        ], 500);
    }
}

/**
 * Remove profile image
 */
public function removeProfileImage()
{
    try {
        $user = Auth::user();

        if ($user->profile_picture) {
            // Delete image file
            $imagePath = public_path('storage/' . $user->profile_picture);
            if (file_exists($imagePath)) {
                unlink($imagePath);
            }

            // Clear from database
            $user->profile_picture = null;
            $user->save();
        }

        return response()->json([
            'status' => 'success',
            'success' => true,
            'message' => 'Profile image removed successfully'
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'success' => false,
            'message' => 'Failed to remove profile image',
            'error' => $e->getMessage()
        ], 500);
    }
}


    public function updateRole(Request $request, $userId)
    {
        try {
            if (!Auth::user()->isSuperAdmin()) {
                return response()->json([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'Unauthorized. Only super admins can update user roles.'
                ], 403);
            }

            $request->validate([
                'role' => 'required|in:user,admin,super_admin'
            ]);

            $user = User::findOrFail($userId);
            $user->role = $request->role;
            $user->save();

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'User role updated successfully',
                'user' => $user
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'An error occurred while updating user role',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}