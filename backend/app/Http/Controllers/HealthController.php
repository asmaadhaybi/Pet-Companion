<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Pet;
use App\Models\MoodTracker;      // ✅ FIXED: Using the correct MoodTracker model
use App\Models\HealthMetrics; // ✅ CORRECT MODEL
use Illuminate\Http\Request;
use App\Models\UserPoints;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class HealthController extends Controller
{
public function recordMood(Request $request)
{
    $validator = Validator::make($request->all(), [
        'pet_id' => 'required|exists:pets,id',
        'mood_level' => 'required|integer|min:1|max:5',
        'notes' => 'nullable|string|max:500'
    ]);

    if ($validator->fails()) {
        return response()->json(['success' => false, 'error' => 'Validation failed', 'validationErrors' => $validator->errors()], 422);
    }

    $userId = Auth::id();
    $petId = $request->pet_id;

    // ✅ FIXED: Changed 'user_id' => $userId to 'user_id', $userId
    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();

    if (!$pet) {
        return response()->json(['success' => false, 'error' => 'Pet not found or access denied'], 404);
    }

    // Using 'create' will always add a new row for each mood entry
    $moodLog = MoodTracker::create([
        'pet_id'        => $petId,
        'mood'          => match ($request->mood_level) {
                                1 => 'very_sad',
                                2 => 'sad',
                                3 => 'neutral',
                                4 => 'happy',
                                5 => 'very_happy',
                                default => 'neutral',
                           },
        'mood_score'    => $request->mood_level,
        'notes'         => $request->notes,
        'recorded_at'   => now()->toISOString(),
        'recorded_date' => now()->format('Y-m-d'),
    ]);

    $pointsEarned = 1;
    $userPoints = UserPoints::firstOrCreate(['user_id' => $userId], ['points' => 0]);
    $userPoints->increment('points', $pointsEarned);

    return response()->json([
        'success' => true,
        'data' => [
            'mood_log' => $moodLog,
            'points_earned' => $pointsEarned,
            'total_user_points' => $userPoints->fresh()->points,
            'message' => 'Mood recorded successfully'
        ]
    ]);
}
 public function getMoodHistory(Request $request, $petId)
    {
        $userId = Auth::id();

        // Verify pet belongs to the user for security
        $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json([
                'success' => false,
                'error' => 'Pet not found or access denied'
            ], 404);
        }

        // Fetch all mood tracker records for this pet, newest first
        $history = MoodTracker::where('pet_id', $petId)
            ->orderBy('recorded_at', 'desc')
            ->paginate(50); // Paginate to handle long histories

        return response()->json([
            'success' => true,
            'data' => $history
        ]);
    }

 public function getHealthStats(Request $request)
{
    $userId = Auth::id();
    $petId = $request->input('pet_id');
    if (!$petId) {
        return response()->json(['success' => false, 'error' => 'Pet ID is required.'], 400);
    }
    $days = $request->input('days', 7);

    $moodLogs = MoodTracker::where('pet_id', $petId)
        ->where('recorded_at', '>=', now()->subDays($days))
        ->orderBy('recorded_at', 'desc')->get();

    $stats = [
        'mood_average' => $moodLogs->avg('mood_score') ?: 0,
        'mood_trend' => $this->calculateMoodTrend($moodLogs),
        'recent_moods' => $moodLogs->take(5)->map(function ($log) {
            return [
                'level' => $log->mood_score,
                // ✅ FIXED: Removed ->toISOString() to let Laravel handle date conversion safely.
                'recorded_at' => $log->recorded_at, 
                'notes' => $log->notes
            ];
        }),
        'health_alerts' => $this->getHealthAlerts($petId),
        'activity_level' => 'Normal'
    ];

    return response()->json([
        'success' => true,
        'data' => $stats
    ]);
}
 // In app/Http/Controllers/HealthController.php

public function getVitalSigns($petId)
{
    $userId = Auth::id();
    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    
    if (!$pet) {
        return response()->json(['success' => false, 'error' => 'Pet not found or access denied'], 404);
    }

    $vitalSigns = HealthMetrics::where('pet_id', $petId)->latest('recorded_at')->first();

    if (!$vitalSigns) {
        // This calls the helper function for default data
        return response()->json(['success' => true, 'data' => $this->getDefaultVitalSigns($pet)]);
    }

    // Make sure there are NO dd() or dump() calls here
    return response()->json([
        'success' => true,
        'data' => [
            'heart_rate'     => $vitalSigns->heart_rate,
            'oxygen_level'   => $vitalSigns->oxygen_level,
            'blood_pressure' => "{$vitalSigns->blood_pressure_systolic}/{$vitalSigns->blood_pressure_diastolic}",
            'recorded_at'    => $vitalSigns->recorded_at
        ]
    ]);
}

private function getDefaultVitalSigns($pet)
{
    $weight = floatval($pet->weight);
    $type = $pet->type;

    if ($type === 'dog') {
        $heartRate = $weight > 30 ? rand(60, 100) : rand(100, 140);
    } else { // cat or other
        $heartRate = rand(120, 140);
    }
    
    // Make sure there are NO dd() or dump() calls here
    return [
        'heart_rate'     => $heartRate,
        'oxygen_level'   => rand(95, 99),
        'blood_pressure' => 'Normal',
        'temperature'    => round(rand(1010, 1025) / 10, 1)
    ];
}

   private function calculateMoodTrend($moodLogs)
    {
        if ($moodLogs->count() < 2) {
            return 'stable';
        }

        // ✅ FIXED: Using the correct column name 'mood_score' instead of 'mood_level'
        $recent = $moodLogs->take(3)->avg('mood_score');
        $previous = $moodLogs->skip(3)->take(3)->avg('mood_score');

        if ($recent > $previous + 0.5) {
            return 'improving';
        } elseif ($recent < $previous - 0.5) {
            return 'declining';
        }

        return 'stable';
    }

    private function getHealthAlerts($petId)
    {
        $alerts = [];

        // ✅ FIXED: Using the correct Model name 'MoodTracker' instead of 'MoodLog'
        $recentMoods = MoodTracker::where('pet_id', $petId)
            ->where('recorded_at', '>=', now()->subDays(3))
            ->get();

        // ✅ FIXED: Using the correct column name 'mood_score' instead of 'mood_level'
        $lowMoodCount = $recentMoods->where('mood_score', '<=', 2)->count();
        if ($lowMoodCount >= 2) {
            $alerts[] = [
                'type' => 'mood',
                'severity' => 'medium',
                'message' => 'Pet has shown low mood multiple times recently'
            ];
        }

        return $alerts;
    }

  

    // private function getDefaultVitalSigns($pet)
    // {
    //     $weight = floatval($pet->weight);
    //     $type = $pet->type;

    //     // Estimate normal ranges based on pet type and size
    //     if ($type === 'dog') {
    //         $heartRate = $weight > 30 ? rand(60, 100) : rand(100, 140);
    //     } else { // cat or other
    //         $heartRate = rand(120, 140);
    //     }

    //     return [
    //         'heart_rate' => $heartRate,
    //         'oxygen_level' => rand(95, 99),
    //         'blood_pressure' => 'Normal',
    //         'temperature' => round(rand(1010, 1025) / 10, 1) // 101.0-102.5°F
    //     ];
    // }
    /**
 * ✨ NEW: This function would receive and save real data from a sensor.
 */
public function recordVitalSigns(Request $request)
{
    $validator = Validator::make($request->all(), [
        'pet_id'          => 'required|exists:pets,id',
        'heart_rate'      => 'required|integer',
        'oxygen_level'    => 'required|integer',
        'systolic_bp'     => 'sometimes|integer', // Example blood pressure
        'diastolic_bp'    => 'sometimes|integer',
    ]);

    if ($validator->fails()) {
        return response()->json(['success' => false, 'error' => $validator->errors()], 422);
    }

    // Verify the pet belongs to the logged-in user
    $pet = Pet::where('id', $request->pet_id)->where('user_id', Auth::id())->first();
    if (!$pet) {
        return response()->json(['success' => false, 'error' => 'Pet not found or access denied'], 404);
    }

    // Save the real data to the database
    $healthMetric = HealthMetrics::create([
        'pet_id'                    => $pet->id,
        'heart_rate'                => $request->heart_rate,
        'oxygen_level'              => $request->oxygen_level,
        'blood_pressure_systolic'   => $request->systolic_bp,
        'blood_pressure_diastolic'  => $request->diastolic_bp,
        'recorded_at'               => now()
    ]);

    return response()->json([
        'success' => true,
        'message' => 'Vital signs recorded successfully.',
        'data'    => $healthMetric
    ]);
}
}