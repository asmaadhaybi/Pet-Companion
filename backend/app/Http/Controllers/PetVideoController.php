<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\PetVideo;
use App\Models\Pet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PetVideoController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:api');
    }

    /**
     * Get all videos for the authenticated user, with filtering and sorting.
     */
    public function index(Request $request)
    {
        try {
            $user = Auth::user();
            $perPage = $request->get('per_page', 10);
            $search = $request->get('search');
            $petId = $request->get('pet_id');
            $favorites = $request->boolean('favorites');
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');

            $query = PetVideo::where('user_id', $user->id)
                ->with(['pet:id,name,type']) // Eager load pet info
                ->orderBy($sortBy, $sortOrder);

            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('title', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%")
                      ->orWhereJsonContains('tags', $search);
                });
            }

            if ($petId) {
                $query->where('pet_id', $petId);
            }

            if ($favorites) {
                $query->where('is_favorite', true);
            }

            $videos = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $videos,
                'message' => 'Videos retrieved successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error retrieving videos: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload a new video for a pet.
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'video' => 'required|file|mimes:mp4,mov,avi,wmv|max:102400', // 100MB max
                'pet_id' => 'required|exists:pets,id',
                'title' => 'nullable|string|max:255',
                'description' => 'nullable|string|max:1000',
                'tags' => 'nullable|array',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = Auth::user();
            $pet = Pet::where('id', $request->pet_id)->where('user_id', $user->id)->firstOrFail();
            
            $file = $request->file('video');
            $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('videos/' . $user->id, $filename, 'public');

            $video = PetVideo::create([
                'user_id' => $user->id,
                'pet_id' => $pet->id,
                'title' => $request->title ?: $file->getClientOriginalName(),
                'description' => $request->description,
                'file_path' => $path,
                'file_size' => $file->getSize(),
                'tags' => $request->tags ?: [],
            ]);

            return response()->json([
                'success' => true,
                'data' => $video->load('pet:id,name,type'),
                'message' => 'Video uploaded successfully'
            ], 201);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
             return response()->json(['success' => false, 'message' => 'Pet not found or does not belong to you'], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error uploading video: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get a specific video's details.
     */
    public function show($id)
    {
        try {
            $user = Auth::user();
            $video = PetVideo::where('user_id', $user->id)
                ->with('pet:id,name,type')
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $video,
                'message' => 'Video retrieved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Video not found'], 404);
        }
    }

    /**
     * Update a video's details (like title, description).
     */
    public function update(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'title' => 'sometimes|string|max:255',
                'description' => 'sometimes|string|max:1000',
                'tags' => 'sometimes|array',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'message' => 'Validation error', 'errors' => $validator->errors()], 422);
            }

            $user = Auth::user();
            $video = PetVideo::where('user_id', $user->id)->findOrFail($id);
            
            $video->update($request->only(['title', 'description', 'tags']));

            return response()->json([
                'success' => true,
                'data' => $video->load('pet:id,name,type'),
                'message' => 'Video updated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error updating video'], 500);
        }
    }

    /**
     * Delete a video.
     */
    public function destroy($id)
    {
        try {
            $user = Auth::user();
            $video = PetVideo::where('user_id', $user->id)->findOrFail($id);

            // Delete the video file from storage
            if ($video->file_path && Storage::disk('public')->exists($video->file_path)) {
                Storage::disk('public')->delete($video->file_path);
            }

            $video->delete();

            return response()->json(['success' => true, 'message' => 'Video deleted successfully']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error deleting video'], 500);
        }
    }

    /**
     * Toggle a video's favorite status.
     */
    public function toggleFavorite($id)
    {
        try {
            $user = Auth::user();
            $video = PetVideo::where('user_id', $user->id)->findOrFail($id);
            $video->is_favorite = !$video->is_favorite;
            $video->save();

            return response()->json([
                'success' => true,
                'data' => $video,
                'message' => $video->is_favorite ? 'Added to favorites' : 'Removed from favorites'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error updating favorite status'], 500);
        }
    }

    /**
     * Get recent videos for a dashboard.
     */
    public function recent(Request $request)
    {
        try {
            $user = Auth::user();
            $limit = $request->get('limit', 5);

            $videos = PetVideo::where('user_id', $user->id)
                ->with('pet:id,name,type')
                ->orderBy('created_at', 'desc')
                ->limit($limit)
                ->get();

            return response()->json(['success' => true, 'data' => $videos]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error retrieving recent videos'], 500);
        }
    }

    /**
     * Get statistics about the user's videos.
     */
    public function stats()
    {
        try {
            $user = Auth::user();
            $stats = [
                'total_videos' => PetVideo::where('user_id', $user->id)->count(),
                'favorites_count' => PetVideo::where('user_id', $user->id)->where('is_favorite', true)->count(),
                'total_storage_used' => PetVideo::where('user_id', $user->id)->sum('file_size'),
            ];
            return response()->json(['success' => true, 'data' => $stats]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error retrieving statistics'], 500);
        }
    }
}