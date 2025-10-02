<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB; // 👈 Make sure to import DB facade

use App\Models\Pet;

class PetController extends Controller
{
    /**
     * Display a listing of the authenticated user's pets.
     */
    public function index(): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }

            $pets = $user->pets()->orderBy('created_at', 'desc')->get();

            // Add photo URLs if they exist
            foreach ($pets as $pet) {
                if ($pet->photo) {
                    $pet->photo_url = Storage::url($pet->photo);
                }
            }

            return response()->json([
                'success' => true,
                'data' => $pets,
                'message' => 'Pets retrieved successfully',
                'count' => $pets->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Error retrieving pets: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error retrieving pets',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created pet.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            // Log the request for debugging
            Log::info('Pet store request data:', $request->all());
            Log::info('Request content type:', [$request->header('Content-Type')]);
            
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }

            // Validation rules
            $rules = [
                'name' => 'required|string|max:255',
                'type' => 'required|in:dog,cat,bird,fish,rabbit,hamster,other',
                'breed' => 'required|string|max:255',
                'age' => 'required|integer|min:0|max:50',
                'weight' => 'required|numeric|min:0.1|max:999.99',
                'size' => 'required|in:small,medium,large,extra_large',
                'activity_level' => 'required|in:low,moderate,high',
                'daily_food_amount' => 'required|numeric|min:1|max:9999.99',
                'feeding_frequency' => 'nullable|integer|min:1|max:10',
                'special_diet' => 'nullable|in:none,grain-free,raw,prescription,senior,weight-management,puppy-kitten',
                'allergies' => 'nullable|string|max:1000',
                'health_conditions' => 'nullable|string|max:1000',
                'photo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
                'birth_date' => 'nullable|date|before:today',
                'microchip_number' => 'nullable|string|max:50',
                'vaccination_records' => 'nullable|array',
                'medical_history' => 'nullable|array'
            ];

            $validator = Validator::make($request->all(), $rules);

            if ($validator->fails()) {
                Log::warning('Pet store validation failed:', $validator->errors()->toArray());
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $petData = [
                'user_id' => $user->id,
                'name' => trim($request->input('name')),
                'type' => $request->input('type'),
                'breed' => trim($request->input('breed')),
                'age' => (int) $request->input('age'),
                'weight' => (float) $request->input('weight'),
                'size' => $request->input('size'),
                'activity_level' => $request->input('activity_level'),
                'daily_food_amount' => (float) $request->input('daily_food_amount'),
                'feeding_frequency' => $request->input('feeding_frequency', 2),
                'special_diet' => $request->input('special_diet', 'none'),
                'allergies' => $request->input('allergies') ? trim($request->input('allergies')) : null,
                'health_conditions' => $request->input('health_conditions') ? trim($request->input('health_conditions')) : null,
                'birth_date' => $request->input('birth_date'),
                'microchip_number' => $request->input('microchip_number'),
            ];
            // ✨ ADD THIS LOGIC HERE
        // Set 'is_active' to true only if it's the user's first pet.
        $petData['is_active'] = $user->pets()->count() === 0;


            // Handle photo upload
            if ($request->hasFile('photo')) {
                Log::info('Photo file detected, uploading...');
                try {
                    $photoPath = $request->file('photo')->store('pet_photos', 'public');
                    $petData['photo'] = $photoPath;
                    Log::info('Photo uploaded successfully:', ['path' => $photoPath]);
                } catch (\Exception $e) {
                    Log::error('Photo upload failed: ' . $e->getMessage());
                    return response()->json([
                        'success' => false,
                        'message' => 'Failed to upload photo',
                        'error' => $e->getMessage()
                    ], 500);
                }
            }

            // Handle JSON fields
            if ($request->has('vaccination_records') && is_array($request->vaccination_records)) {
                $petData['vaccination_records'] = json_encode($request->vaccination_records);
            }

            if ($request->has('medical_history') && is_array($request->medical_history)) {
                $petData['medical_history'] = json_encode($request->medical_history);
            }

            Log::info('Creating pet with data:', $petData);
            
            $pet = Pet::create($petData);

            // Add photo URL if exists
            if ($pet->photo) {
                $pet->photo_url = Storage::url($pet->photo);
            }

            // Prepare response data
            $responseData = $pet->toArray();
            $responseData['vaccination_records'] = $pet->vaccination_records ? json_decode($pet->vaccination_records, true) : [];
            $responseData['medical_history'] = $pet->medical_history ? json_decode($pet->medical_history, true) : [];

            Log::info('Pet created successfully:', ['pet_id' => $pet->id]);

            return response()->json([
                'success' => true,
                'data' => $responseData,
                'message' => 'Pet created successfully'
            ], 201);

        } catch (\Exception $e) {
            Log::error('Error creating pet: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Error creating pet',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Alias for store method to maintain compatibility
     */
    public function savePetInfo(Request $request): JsonResponse
    {
        return $this->store($request);
    }

    /**
     * Display the specified pet.
     */
    public function show(string $id): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }

           $pet = $user->pets()->with(['games' => function($query) {
            $query->completed();  // <-- requires `completed` column + scope in GameSession.php
        }])->findOrFail($id);

            // Add photo URL if exists
            if ($pet->photo) {
                $pet->photo_url = Storage::url($pet->photo);
            }

            // Decode JSON fields
            $pet->vaccination_records = $pet->vaccination_records ? json_decode($pet->vaccination_records, true) : [];
            $pet->medical_history = $pet->medical_history ? json_decode($pet->medical_history, true) : [];

            return response()->json([
                'success' => true,
                'data' => $pet,
                'message' => 'Pet retrieved successfully'
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Pet not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error retrieving pet: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error retrieving pet',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified pet.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        try {
            // Log the request for debugging
            Log::info('Pet update request data:', $request->all());
            Log::info('Request method: ' . $request->method());
            
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }

            $pet = $user->pets()->findOrFail($id);

            // Validation rules
            $rules = [
                'name' => 'sometimes|required|string|max:255',
                'type' => 'sometimes|required|in:dog,cat,bird,fish,rabbit,hamster,other',
                'breed' => 'sometimes|required|string|max:255',
                'age' => 'sometimes|required|integer|min:0|max:50',
                'weight' => 'sometimes|required|numeric|min:0.1|max:999.99',
                'size' => 'sometimes|required|in:small,medium,large,extra_large',
                'activity_level' => 'sometimes|required|in:low,moderate,high',
                'daily_food_amount' => 'sometimes|required|numeric|min:1|max:9999.99',
                'feeding_frequency' => 'nullable|integer|min:1|max:10',
                'special_diet' => 'nullable|in:none,grain-free,raw,prescription,senior,weight-management,puppy-kitten',
                'allergies' => 'nullable|string|max:1000',
                'health_conditions' => 'nullable|string|max:1000',
                'photo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
                'birth_date' => 'nullable|date|before:today',
                'microchip_number' => 'nullable|string|max:50',
                'vaccination_records' => 'nullable|array',
                'medical_history' => 'nullable|array'
            ];

            $validator = Validator::make($request->all(), $rules);

            if ($validator->fails()) {
                Log::warning('Pet update validation failed:', $validator->errors()->toArray());
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $updateData = [];
            
            // Only update fields that are present in request
            $fillableFields = ['name', 'type', 'breed', 'age', 'weight', 'size', 
                              'activity_level', 'daily_food_amount', 'feeding_frequency', 
                              'special_diet', 'allergies', 'health_conditions', 
                              'birth_date', 'microchip_number'];
            
            foreach ($fillableFields as $field) {
                if ($request->has($field)) {
                    $value = $request->input($field);
                    
                    // Type casting for specific fields
                    switch ($field) {
                        case 'age':
                        case 'feeding_frequency':
                            $updateData[$field] = (int) $value;
                            break;
                        case 'weight':
                        case 'daily_food_amount':
                            $updateData[$field] = (float) $value;
                            break;
                        case 'name':
                        case 'breed':
                        case 'allergies':
                        case 'health_conditions':
                            $updateData[$field] = $value ? trim($value) : null;
                            break;
                        default:
                            $updateData[$field] = $value;
                    }
                }
            }

            // Handle photo upload
            if ($request->hasFile('photo')) {
                Log::info('Photo file detected for update, uploading...');
                try {
                    // Delete old photo if exists
                    if ($pet->photo && Storage::exists('public/' . $pet->photo)) {
                        Storage::delete('public/' . $pet->photo);
                        Log::info('Old photo deleted: ' . $pet->photo);
                    }
                    
                    $photoPath = $request->file('photo')->store('pet_photos', 'public');
                    $updateData['photo'] = $photoPath;
                    Log::info('New photo uploaded successfully:', ['path' => $photoPath]);
                } catch (\Exception $e) {
                    Log::error('Photo upload failed during update: ' . $e->getMessage());
                    return response()->json([
                        'success' => false,
                        'message' => 'Failed to upload photo',
                        'error' => $e->getMessage()
                    ], 500);
                }
            }

            // Handle JSON fields
            if ($request->has('vaccination_records')) {
                $updateData['vaccination_records'] = is_array($request->vaccination_records) 
                    ? json_encode($request->vaccination_records) 
                    : $request->vaccination_records;
            }

            if ($request->has('medical_history')) {
                $updateData['medical_history'] = is_array($request->medical_history) 
                    ? json_encode($request->medical_history) 
                    : $request->medical_history;
            }

            Log::info('Updating pet with data:', $updateData);

            $pet->update($updateData);

            // Refresh the pet model
            $pet = $pet->fresh();

            // Add photo URL if exists
            if ($pet->photo) {
                $pet->photo_url = Storage::url($pet->photo);
            }

            // Prepare response data
            $responseData = $pet->toArray();
            $responseData['vaccination_records'] = $pet->vaccination_records ? json_decode($pet->vaccination_records, true) : [];
            $responseData['medical_history'] = $pet->medical_history ? json_decode($pet->medical_history, true) : [];

            Log::info('Pet updated successfully:', ['pet_id' => $pet->id]);

            return response()->json([
                'success' => true,
                'data' => $responseData,
                'message' => 'Pet updated successfully'
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Pet not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error updating pet: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Error updating pet',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified pet.
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }

            $pet = $user->pets()->findOrFail($id);

            // Delete photo if exists
            if ($pet->photo && Storage::exists('public/' . $pet->photo)) {
                Storage::delete('public/' . $pet->photo);
                Log::info('Pet photo deleted: ' . $pet->photo);
            }

            $petName = $pet->name;
            $pet->delete();

            Log::info('Pet deleted successfully:', ['pet_name' => $petName, 'pet_id' => $id]);

            return response()->json([
                'success' => true,
                'message' => "Pet '{$petName}' deleted successfully"
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Pet not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error deleting pet: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error deleting pet',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    

    /**
     * Upload pet photo separately
     */
    // public function uploadPhoto(Request $request, string $id): JsonResponse
    // {
    //     try {
    //         $validator = Validator::make($request->all(), [
    //             'photo' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048'
    //         ]);

    //         if ($validator->fails()) {
    //             return response()->json([
    //                 'success' => false,
    //                 'message' => 'Invalid photo file',
    //                 'errors' => $validator->errors()
    //             ], 422);
    //         }

    //         $user = Auth::user();
            
    //         if (!$user) {
    //             return response()->json([
    //                 'success' => false,
    //                 'message' => 'User not authenticated'
    //             ], 401);
    //         }

    //         $pet = $user->pets()->findOrFail($id);

    //         // Delete old photo if exists
    //         if ($pet->photo && Storage::exists('public/' . $pet->photo)) {
    //             Storage::delete('public/' . $pet->photo);
    //         }

    //         // Store new photo
    //         $photoPath = $request->file('photo')->store('pet_photos', 'public');
    //         $pet->update(['photo' => $photoPath]);

    //         Log::info('Pet photo uploaded successfully:', ['pet_id' => $id, 'photo_path' => $photoPath]);

    //         return response()->json([
    //             'success' => true,
    //             'data' => [
    //                 'photo_path' => $photoPath,
    //                 'photo_url' => Storage::url($photoPath)
    //             ],
    //             'message' => 'Photo uploaded successfully'
    //         ]);

    //     } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
    //         return response()->json([
    //             'success' => false,
    //             'message' => 'Pet not found'
    //         ], 404);
    //     } catch (\Exception $e) {
    //         Log::error('Error uploading photo: ' . $e->getMessage());
    //         return response()->json([
    //             'success' => false,
    //             'message' => 'Error uploading photo',
    //             'error' => $e->getMessage()
    //         ], 500);
    //     }
    // }


    // app/Http/Controllers/PetController.php

public function uploadPhoto(Request $request, string $id): JsonResponse
{
    try {
        // ... (validation and user check code remains the same) ...

        $user = Auth::user();
        $pet = $user->pets()->findOrFail($id);

        // ... (delete old photo code remains the same) ...

        // Store new photo
        $photoPath = $request->file('photo')->store('pet_photos', 'public');
        $pet->update(['photo' => $photoPath]);

        // ✅ FIXED: Return the entire updated pet model.
        // The `fresh()` method reloads the model from the database to get all accessors like `photo_url`.
        return response()->json([
            'success' => true,
            'data' => $pet->fresh(), // <-- THIS IS THE CHANGE
            'message' => 'Photo uploaded successfully'
        ]);

    } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
        return response()->json([
            'success' => false,
            'message' => 'Pet not found'
        ], 404);
    } catch (\Exception $e) {
        Log::error('Error uploading photo: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Error uploading photo',
            'error' => $e->getMessage()
        ], 500);
    }
}

   /**
 * Delete pet photo
 */
public function deletePhoto($id): JsonResponse
{
    try {
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not authenticated'
            ], 401);
        }

        $pet = $user->pets()->findOrFail($id);

        if (!$pet->photo) {
            return response()->json([
                'success' => false,
                'message' => 'No photo to delete'
            ], 404);
        }

        // Delete photo file
        if (Storage::exists('public/' . $pet->photo)) {
            Storage::delete('public/' . $pet->photo);
        }

        // Remove photo path from database
        $pet->update(['photo' => null]);

        Log::info('Pet photo deleted successfully:', ['pet_id' => $pet->id]);

        return response()->json([
            'success' => true,
            'message' => 'Photo deleted successfully'
        ]);

    } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
        return response()->json([
            'success' => false,
            'message' => 'Pet not found'
        ], 404);
    } catch (\Exception $e) {
        Log::error('Error deleting photo: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Error deleting photo',
            'error' => $e->getMessage()
        ], 500);
    }
}


    /**
     * Get pet recommendations based on pet info
     */
    public function getRecommendations(string $id): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }

            $pet = $user->pets()->findOrFail($id);

            // Generate recommendations based on pet data
            $recommendations = [
                'feeding' => $this->getFeedingRecommendations($pet),
                'exercise' => $this->getExerciseRecommendations($pet),
                'health' => $this->getHealthRecommendations($pet),
                'products' => $this->getProductRecommendations($pet)
            ];

            return response()->json([
                'success' => true,
                'data' => $recommendations,
                'message' => 'Recommendations generated successfully'
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Pet not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error generating recommendations: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error generating recommendations',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get food recommendations for pet
     */
    public function getFoodRecommendations(string $id): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }

            $pet = $user->pets()->findOrFail($id);

            $recommendations = [
                'food_type' => $this->getRecommendedFoodType($pet),
                'daily_amount' => $pet->daily_food_amount,
                'feeding_schedule' => $this->getFeedingRecommendations($pet),
                'special_considerations' => $this->getFoodSpecialConsiderations($pet)
            ];

            return response()->json([
                'success' => true,
                'data' => $recommendations,
                'message' => 'Food recommendations retrieved successfully'
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Pet not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error getting food recommendations: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error getting food recommendations',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get feeding schedule for pet
     */
    public function getFeedingSchedule(string $id): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }

            $pet = $user->pets()->findOrFail($id);

            $schedule = [
                'frequency' => $pet->feeding_frequency,
                'daily_amount' => $pet->daily_food_amount,
                'meal_size' => round($pet->daily_food_amount / $pet->feeding_frequency, 2),
                'feeding_times' => $this->generateFeedingTimes($pet->feeding_frequency),
                'recommendations' => $this->getFeedingRecommendations($pet)
            ];

            return response()->json([
                'success' => true,
                'data' => $schedule,
                'message' => 'Feeding schedule retrieved successfully'
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Pet not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error getting feeding schedule: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error getting feeding schedule',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get exercise recommendations for pet
     */
    public function getExerciseRecommendations(string $id): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }

            $pet = $user->pets()->findOrFail($id);

            $recommendations = $this->buildExerciseRecommendations($pet);

            return response()->json([
                'success' => true,
                'data' => $recommendations,
                'message' => 'Exercise recommendations retrieved successfully'
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Pet not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error getting exercise recommendations: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error getting exercise recommendations',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get health tips for pet
     */
    public function getHealthTips(string $id): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }

            $pet = $user->pets()->findOrFail($id);

            $healthTips = [
                'general_tips' => $this->getGeneralHealthTips($pet),
                'breed_specific' => $this->getBreedSpecificTips($pet),
                'age_specific' => $this->getAgeSpecificTips($pet),
                'vaccination_reminders' => $this->getVaccinationReminders($pet),
                'health_alerts' => $this->getHealthAlerts($pet)
            ];

            return response()->json([
                'success' => true,
                'data' => $healthTips,
                'message' => 'Health tips retrieved successfully'
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Pet not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error getting health tips: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error getting health tips',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Private helper methods for recommendations

    private function getFeedingRecommendations($pet): array
    {
        $baseCalories = $this->calculateBaseCalories($pet);
        
        return [
            'daily_calories' => round($baseCalories),
            'daily_food_grams' => $pet->daily_food_amount,
            'meals_per_day' => $pet->feeding_frequency,
            'meal_size_grams' => round($pet->daily_food_amount / $pet->feeding_frequency),
            'feeding_times' => $this->generateFeedingTimes($pet->feeding_frequency),
            'water_intake_ml' => round($pet->weight * 30), // 30ml per kg
            'tips' => $this->getFeedingTips($pet)
        ];
    }

    private function buildExerciseRecommendations($pet): array
    {
        $exerciseMinutes = $this->calculateExerciseMinutes($pet);
        
        return [
            'daily_exercise_minutes' => $exerciseMinutes,
            'walks_per_day' => $pet->activity_level === 'high' ? 3 : ($pet->activity_level === 'moderate' ? 2 : 1),
            'play_sessions' => $pet->activity_level === 'high' ? 2 : 1,
            'activities' => $this->getSuggestedActivities($pet),
            'tips' => $this->getExerciseTips($pet)
        ];
    }

    private function getHealthRecommendations($pet): array
    {
        return [
            'vet_checkup_frequency' => $pet->age > 7 ? 'Every 6 months' : 'Once a year',
            'vaccination_reminders' => $this->getVaccinationReminders($pet),
            'health_alerts' => $this->getHealthAlerts($pet),
            'grooming_frequency' => $this->getGroomingFrequency($pet),
            'tips' => $this->getGeneralHealthTips($pet)
        ];
    }

    private function getProductRecommendations($pet): array
    {
        return [
            'food_type' => $this->getRecommendedFoodType($pet),
            'toy_suggestions' => $this->getToyRecommendations($pet),
            'accessories' => $this->getAccessoryRecommendations($pet),
            'health_products' => $this->getHealthProductRecommendations($pet)
        ];
    }

    private function getFoodSpecialConsiderations($pet): array
    {
        $considerations = [];
        
        if ($pet->allergies) {
            $considerations[] = 'Avoid allergens: ' . $pet->allergies;
        }
        
        if ($pet->health_conditions) {
            $considerations[] = 'Health conditions to consider: ' . $pet->health_conditions;
        }
        
        if ($pet->special_diet !== 'none') {
            $considerations[] = 'Special diet requirements: ' . str_replace('-', ' ', $pet->special_diet);
        }
        
        return $considerations;
    }

    private function calculateBaseCalories($pet): float
    {
        $baseCalories = $pet->weight * 30; // Base metabolic rate
        
        // Adjust for activity level
        switch ($pet->activity_level) {
            case 'low':
                $baseCalories *= 1.2;
                break;
            case 'moderate':
                $baseCalories *= 1.5;
                break;
            case 'high':
                $baseCalories *= 1.8;
                break;
        }

        // Adjust for age
        if ($pet->age > 7) {
            $baseCalories *= 0.9; // Senior pets need fewer calories
        } elseif ($pet->age < 1) {
            $baseCalories *= 2; // Puppies/kittens need more calories
        }

        return $baseCalories;
    }

    private function calculateExerciseMinutes($pet): int
    {
        $baseMinutes = match($pet->type) {
            'dog' => match($pet->size) {
                'small' => 30,
                'medium' => 60,
                'large' => 90,
                'extra_large' => 120,
                default => 60
            },
            'cat' => 20,
            default => 15
        };

        return match($pet->activity_level) {
            'low' => (int)($baseMinutes * 0.5),
            'moderate' => $baseMinutes,
            'high' => (int)($baseMinutes * 1.5),
            default => $baseMinutes
        };
    }

    private function generateFeedingTimes($frequency): array
    {
        return match($frequency) {
            1 => ['08:00'],
            2 => ['08:00', '18:00'],
            3 => ['07:00', '13:00', '19:00'],
            4 => ['07:00', '12:00', '17:00', '21:00'],
            default => ['08:00', '18:00']
        };
    }

    private function getFeedingTips($pet): array
    {
        $tips = [
            'Always provide fresh water',
            'Feed at consistent times each day',
            'Monitor your pet\'s weight regularly'
        ];

        if ($pet->special_diet !== 'none') {
            $tips[] = "Follow {$pet->special_diet} diet requirements strictly";
        }

        if ($pet->allergies) {
            $tips[] = 'Avoid known allergens: ' . $pet->allergies;
        }

        return $tips;
    }

    private function getExerciseTips($pet): array
    {
        return [
            'Start slowly and build up exercise gradually',
            'Watch for signs of fatigue',
            'Provide rest breaks during long activities',
            'Adjust exercise based on weather conditions'
        ];
    }
 public function setActive(Request $request, Pet $pet): JsonResponse
    {
        // 1. Authorization: Ensure the user owns the pet
        if ($request->user()->id !== $pet->user_id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        // 2. Use a Database Transaction for safety
        DB::transaction(function () use ($request, $pet) {
            // First, set all other pets of this user to inactive
            $request->user()->pets()->where('id', '!=', $pet->id)->update(['is_active' => false]);

            // Then, set the selected pet to active
            $pet->update(['is_active' => true]);
        });
        
        // 3. Return a successful response with the updated pet
        return response()->json([
            'success' => true,
            'message' => $pet->name . ' is now the active pet!',
            'data' => $pet->fresh(), // Return the freshly updated pet data
        ]);
    }

    private function getSuggestedActivities($pet): array
    {
        return match($pet->type) {
            'dog' => ['Walking', 'Fetch', 'Swimming', 'Agility training'],
            'cat' => ['Interactive toys', 'Climbing', 'Hunting games', 'Laser pointer'],
            'rabbit' => ['Hopping exercises', 'Tunnel play', 'Foraging'],
            'bird' => ['Flying time', 'Perch hopping', 'Toy interaction'],
            default => ['Interactive play', 'Environmental enrichment']
        };
    }

    private function getVaccinationReminders($pet): array
    {
        return [
            'Core vaccines due in: 6 months',
            'Rabies vaccine due in: 1 year',
            'Parasite prevention: Monthly'
        ];
    }

    private function getHealthAlerts($pet): array
    {
        $alerts = [];
        
        if ($pet->age > 7) {
            $alerts[] = 'Senior pet - increased health monitoring recommended';
        }
        
        if ($pet->weight > 30 && $pet->size === 'medium') {
            $alerts[] = 'Weight may be above ideal range - consult vet';
        }
        
        if ($pet->health_conditions) {
            $alerts[] = 'Monitor existing health conditions: ' . $pet->health_conditions;
        }
        
        return $alerts;
    }

    private function getGroomingFrequency($pet): string
    {
        return match($pet->type) {
            'dog' => match($pet->size) {
                'small' => 'Every 4-6 weeks',
                'medium' => 'Every 6-8 weeks',
                'large', 'extra_large' => 'Every 8-12 weeks',
                default => 'Every 6-8 weeks'
            },
            'cat' => 'Self-grooming, brush weekly',
            'rabbit' => 'Brush 2-3 times per week',
            default => 'As needed'
        };
    }

    private function getGeneralHealthTips($pet): array
    {
        return [
            'Schedule regular vet checkups',
            'Keep up with vaccinations',
            'Watch for changes in behavior or appetite',
            'Maintain good dental hygiene',
            'Keep your pet at a healthy weight'
        ];
    }

    private function getBreedSpecificTips($pet): array
    {
        // This could be expanded with a database of breed-specific tips
        $tips = [];
        
        $breedLower = strtolower($pet->breed);
        
        if (strpos($breedLower, 'bulldog') !== false) {
            $tips[] = 'Monitor for breathing difficulties due to flat face';
            $tips[] = 'Be careful with exercise in hot weather';
        }
        
        if (strpos($breedLower, 'golden retriever') !== false || strpos($breedLower, 'labrador') !== false) {
            $tips[] = 'Monitor for hip dysplasia';
            $tips[] = 'Watch for weight gain as they love food';
        }
        
        if (empty($tips)) {
            $tips[] = 'Research breed-specific health concerns with your vet';
        }
        
        return $tips;
    }

    private function getAgeSpecificTips($pet): array
    {
        if ($pet->age < 1) {
            return [
                'Puppy/kitten needs frequent feeding',
                'Socialize early with other pets and people',
                'Start basic training early',
                'Puppy-proof your home'
            ];
        } elseif ($pet->age > 7) {
            return [
                'More frequent vet checkups recommended',
                'Monitor for arthritis and joint issues',
                'Consider senior-specific diet',
                'Watch for cognitive changes'
            ];
        } else {
            return [
                'Maintain regular exercise routine',
                'Annual vet checkups sufficient',
                'Monitor weight to prevent obesity',
                'Keep up with dental care'
            ];
        }
    }

    private function getRecommendedFoodType($pet): string
    {
        if ($pet->special_diet !== 'none') {
            return ucwords(str_replace('-', ' ', $pet->special_diet)) . ' Food';
        }
        
        return match($pet->age) {
            0 => 'Puppy/Kitten Food',
            1, 2, 3, 4, 5, 6 => 'Adult Food',
            default => 'Senior Food'
        };
    }

    private function getToyRecommendations($pet): array
    {
        return match($pet->type) {
            'dog' => ['Chew toys', 'Balls', 'Rope toys', 'Puzzle toys'],
            'cat' => ['Feather wands', 'Mice toys', 'Scratching posts', 'Catnip toys'],
            'bird' => ['Foraging toys', 'Puzzle toys', 'Bells', 'Mirrors'],
            'rabbit' => ['Chew toys', 'Tunnels', 'Balls', 'Willow toys'],
            default => ['Interactive toys', 'Chew toys']
        };
    }

    private function getAccessoryRecommendations($pet): array
    {
        return match($pet->type) {
            'dog' => ['Leash and collar', 'Dog bed', 'Food/water bowls', 'Crate'],
            'cat' => ['Litter box', 'Cat carrier', 'Scratching post', 'Cat bed'],
            'bird' => ['Perches', 'Cage accessories', 'Food dishes', 'Cuttlebone'],
            'rabbit' => ['Hay rack', 'Water bottle', 'Litter box', 'Exercise pen'],
            default => ['Food bowls', 'Bedding', 'Carrier']
        };
    }

    private function getHealthProductRecommendations($pet): array
    {
        return [
            'Flea and tick prevention',
            'Dental chews',
            'Joint supplements (if senior)',
            'Multivitamins',
            'Grooming supplies'
        ];
    }

   public function updateAutoDispenseSettings(Request $request, $petId)
{
    $validator = Validator::make($request->all(), [
        'auto_dispense_enabled'   => 'required|boolean',
        // ✅ CHANGED: Validate the correct field name
        'water_auto_threshold' => 'required|integer|min:5|max:50',
    ]);

    if ($validator->fails()) {
        return response()->json(['success' => false, 'error' => 'Validation failed', 'validationErrors' => $validator->errors()], 422);
    }

    $pet = Pet::where('id', $petId)->where('user_id', Auth::id())->first();

    if (!$pet) {
        return response()->json(['success' => false, 'error' => 'Pet not found'], 404);
    }

    $pet->update([
        'auto_dispense_enabled'   => $request->auto_dispense_enabled,
        // ✅ CHANGED: Update the correct column
        'water_auto_threshold' => $request->water_auto_threshold,
    ]);

    return response()->json([
        'success' => true,
        'message' => 'Auto-dispense settings updated successfully.',
        'data'    => $pet->fresh()
    ]);
}
}