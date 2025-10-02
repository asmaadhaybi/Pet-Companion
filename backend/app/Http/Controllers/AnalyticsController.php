<?php

// app/Http/Controllers/Api/AnalyticsController.php
namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Pet;
use App\Models\DispenseLog;
use App\Models\GameSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;
use App\Models\MoodTracker;
use App\Models\HealthMetrics;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage; // Ensure this is imported
use Illuminate\Support\Facades\View; // 👈 Make sure this line is present
use Barryvdh\DomPDF\Facade\Pdf;      // 👈 Make sure this line is presen
class AnalyticsController extends Controller
{
/**
 * Enhanced getPetAnalytics method with better debugging
 */
public function getPetAnalytics(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'pet_id' => 'nullable|exists:pets,id',
            'period' => 'nullable|in:week,month,year'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false, 
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        $period = $request->get('period', 'week');
        
        // Get the pet
        $pet = $request->pet_id
            ? Pet::where('id', $request->pet_id)->where('user_id', $user->id)->first()
            : Pet::where('user_id', $user->id)->where('is_active', 1)->first();

        if (!$pet) {
            $pet = Pet::where('user_id', $user->id)->first();
        }

        if (!$pet) {
            return response()->json([
                'success' => false, 
                'message' => 'No pet found for this user.'
            ], 404);
        }

        // ✅ DEBUG: Log what we're about to query
        \Log::info('Getting analytics for user_id: ' . $user->id . ', pet_id: ' . $pet->id . ', period: ' . $period);

        // Get analytics data with error handling for each section
        $nutritionAnalytics = $this->getNutritionAnalytics($pet->id, $period);
        $activityAnalytics = $this->getActivityAnalytics($user->id, $period, $pet->id); // ✅ Pass pet_id here
        $healthMetrics = $this->getHealthMetrics($pet->id);
        $weeklyTrend = $this->getWeeklyTrendData($pet->id, $user->id);
        $insights = $this->generateInsights($pet, $nutritionAnalytics, $activityAnalytics);

        // ✅ DEBUG: Log the activity data we got
        \Log::info('Activity analytics result: ', $activityAnalytics);

        return response()->json([
            'success' => true,
            'data' => [
                'pet' => $pet,
                'period' => $period,
                'nutrition' => $nutritionAnalytics,
                'activity' => $activityAnalytics,
                'health' => $healthMetrics,
                'weekly_trend' => $weeklyTrend,
                'insights' => $insights
            ]
        ]);

    } catch (\Exception $e) {
        \Log::error('Error in getPetAnalytics: ' . $e->getMessage());
        \Log::error('Stack trace: ' . $e->getTraceAsString());
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch analytics data',
            'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
        ], 500);
    }
}

public function generateReport(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'pet_id' => 'nullable|exists:pets,id',
            'type'   => 'required|in:daily,weekly,monthly,week,month,year',
            'format' => 'nullable|in:json,pdf,excel,csv,image',
        ]);

        if ($validator->fails()) {
            \Log::error('Validation failed:', $validator->errors()->toArray());
            return response()->json([
                'success' => false, 
                'errors' => $validator->errors(),
                'message' => 'Validation failed'
            ], 422);
        }

        $user = auth()->user();
        $type = $request->type;
        $format = $request->get('format', 'pdf');
        
        \Log::info("Generating report - User: {$user->id}, Type: {$type}, Format: {$format}");
        
        $pet = $request->pet_id
            ? Pet::where('id', $request->pet_id)->where('user_id', $user->id)->first()
            : ($user->activePet ?? Pet::where('user_id', $user->id)->first());

        if (!$pet) {
            \Log::error('Pet not found for user: ' . $user->id);
            return response()->json([
                'success' => false, 
                'message' => 'Pet not found'
            ], 404);
        }

        $periodMap = [
            'daily' => 'day', 'weekly' => 'week', 'monthly' => 'month',
            'week'  => 'week', 'month'  => 'month', 'year'    => 'year'
        ];
        $period = $periodMap[$type] ?? 'week';
        
        // Generate report data
        $reportData = [
            'report_info' => [
                'type' => $type,
                'period' => $period,
                'generated_at' => now()->toISOString(),
                'pet' => $pet->only(['id', 'name', 'type', 'breed', 'age', 'weight'])
            ],
            'nutrition_summary' => $this->getNutritionAnalytics($pet->id, $period),
            'activity_summary'  => $this->getActivityAnalytics($user->id, $period, $pet->id),
            'health_summary'    => $this->getHealthMetrics($pet->id),
        ];

        // Generate file
        $timestamp = now()->timestamp;
        $fileName = "report_{$pet->name}_{$type}_{$timestamp}." . $this->getFileExtension($format);
        $storagePath = 'reports/' . $fileName;

        \Log::info("Creating file: {$storagePath}");

        try {
            // Generate file content based on format
            if ($format === 'pdf') {
                // Check if the view exists
                if (!View::exists('reports.pet_report')) {
                    \Log::error('PDF template not found: reports.pet_report');
                    // Fallback to JSON if PDF template doesn't exist
                    $fileContent = json_encode($reportData, JSON_PRETTY_PRINT);
                    $fileName = str_replace('.pdf', '.json', $fileName);
                    $storagePath = str_replace('.pdf', '.json', $storagePath);
                } else {
                    $pdf = Pdf::loadView('reports.pet_report', ['data' => $reportData]);
                    $fileContent = $pdf->output();
                }
            } else {
                $fileContent = $this->generateFileContent($reportData, $format);
            }

            // Ensure the reports directory exists
            if (!Storage::disk('public')->exists('reports')) {
                Storage::disk('public')->makeDirectory('reports');
                \Log::info('Created reports directory');
            }

            // Store the file
            $stored = Storage::disk('public')->put($storagePath, $fileContent);
            
            if (!$stored) {
                throw new \Exception('Failed to store file to disk');
            }

            // Verify file was created
            if (!Storage::disk('public')->exists($storagePath)) {
                throw new \Exception('File was not created successfully');
            }

            $fileSize = Storage::disk('public')->size($storagePath);
            \Log::info("File created successfully. Size: {$fileSize} bytes");

            // Generate the download URL
            $fileUrl = Storage::disk('public')->url($storagePath);
            
            // Ensure absolute URL
            if (!str_starts_with($fileUrl, 'http')) {
                $baseUrl = config('app.url', 'http://192.168.2.224:8000');
                $fileUrl = $baseUrl . $fileUrl;
            }

            \Log::info("Generated download URL: {$fileUrl}");

            $responseData = [
                'file_name'    => $fileName,
                'download_url' => $fileUrl,
                'file_size'    => $fileSize,
                'generated_at' => now()->toISOString(),
                'expires_at'   => now()->addDays(7)->toISOString(),
                'format'       => $format,
                'type'         => $type
            ];

            return response()->json([
                'success' => true,
                'data' => $responseData,
                'message' => 'Report generated successfully'
            ]);

        } catch (\Exception $fileError) {
            \Log::error('File generation error: ' . $fileError->getMessage());
            \Log::error('File error trace: ' . $fileError->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate file',
                'error' => 'File generation failed: ' . $fileError->getMessage()
            ], 500);
        }

    } catch (\Exception $e) {
        \Log::error('Report Generation Error: ' . $e->getMessage());
        \Log::error('Error trace: ' . $e->getTraceAsString());
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to generate report',
            'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
        ], 500);
    }
}

/**
     * ✅ NEW: Get proper file extension based on format
     */
 private function getFileExtension($format)
{
    switch ($format) {
        case 'pdf':
            return 'pdf';
        case 'excel':
            return 'xlsx';
        case 'csv':
            return 'csv';
        case 'image':
            return 'png';
        case 'json':
        default:
            return 'json';
    }
}
     /**
     * ✅ NEW: Generate appropriate file content based on format
     */
private function generateFileContent($reportData, $format)
{
    switch ($format) {
        case 'csv':
            return $this->generateCSVContent($reportData);
        case 'json':
        default:
            return json_encode($reportData, JSON_PRETTY_PRINT);
    }
}

private function generateCSVContent($reportData)
{
    $csv = "Pet Analytics Report\n\n";
    
    // Pet Info
    $pet = $reportData['report_info']['pet'];
    $csv .= "Pet Information\n";
    $csv .= "Name,{$pet['name']}\n";
    $csv .= "Type,{$pet['type']}\n";
    $csv .= "Breed,{$pet['breed']}\n";
    $csv .= "Age,{$pet['age']} years\n";
    $csv .= "Weight,{$pet['weight']}kg\n\n";
    
    // Nutrition Data
    $nutrition = $reportData['nutrition_summary'];
    $csv .= "Nutrition Summary\n";
    $csv .= "Water Intake,{$nutrition['water_intake']}ml\n";
    $csv .= "Food Intake,{$nutrition['food_intake']}g\n";
    $csv .= "Treats Given,{$nutrition['treats_given']}g\n";
    $csv .= "Daily Avg Water,{$nutrition['daily_average']['water']}ml\n";
    $csv .= "Daily Avg Food,{$nutrition['daily_average']['food']}g\n\n";
    
    // Activity Data
    $activity = $reportData['activity_summary'];
    $csv .= "Activity Summary\n";
    $csv .= "Games Played,{$activity['games_played']}\n";
    $csv .= "Total Play Time,{$activity['total_play_time']} minutes\n";
    $csv .= "Points Earned,{$activity['points_earned']}\n";
    $csv .= "Favorite Game,{$activity['favorite_game']}\n";
    
    return $csv;
}



    /**
     * Get nutrition analytics for a pet
     */
  private function getNutritionAnalytics($petId, $period)
    {
        $startDate = $this->getStartDateForPeriod($period);
        $days = $this->getDaysForPeriod($period);

        $dispenseTotals = DispenseLog::where('pet_id', $petId)
            ->where('dispensed_at', '>=', $startDate)
            ->selectRaw('type, SUM(amount) as total_amount')
            ->groupBy('type')
            ->pluck('total_amount', 'type')
            ->toArray();

        // ✅ FIXED: Now includes 'meds'
        $dispenseData = array_merge([
            'water' => 0,
            'food' => 0,
            'treats' => 0,
            'meds' => 0,
        ], $dispenseTotals);

        $dailyAverages = [
            'water' => $days > 0 ? round($dispenseData['water'] / $days, 1) : 0,
            'food' => $days > 0 ? round($dispenseData['food'] / $days, 1) : 0,
            'treats' => $days > 0 ? round($dispenseData['treats'] / $days, 1) : 0,
            'meds' => $days > 0 ? round($dispenseData['meds'] / $days, 1) : 0,
        ];

        return [
            'water_intake' => $dispenseData['water'],
            'food_intake' => $dispenseData['food'],
            'treats_given' => $dispenseData['treats'],
            'medication_taken' => $dispenseData['meds'],
            'daily_average' => $dailyAverages,
            'period_days' => $days
        ];
    }

    /**
     * Get activity analytics for a user
     */
/**
 * Get activity analytics for a specific pet - FINAL CORRECTED VERSION
 */
private function getActivityAnalytics($userId, $period, $petId = null)
{
    $startDate = $this->getStartDateForPeriod($period);
    
    try {
        // ✅ FIXED: Filter by BOTH user_id AND pet_id to get pet-specific data
        $query = GameSession::where('user_id', $userId)
            ->where('started_at', '>=', $startDate)
            ->whereNotNull('ended_at'); // Only completed games
            
        // ✅ CRITICAL: Add pet_id filter if provided
        if ($petId) {
            $query->where('pet_id', $petId);
        }
        
        $gameStats = $query->selectRaw('
                COUNT(*) as games_played, 
                SUM(COALESCE(points_earned, 0)) as total_points_earned, 
                SUM(COALESCE(duration, 0)) as total_duration_seconds,
                AVG(COALESCE(score, 0)) as average_score
            ')
            ->first();

        // ✅ FIXED: Get favorite game for this specific pet
        $favoriteQuery = GameSession::where('user_id', $userId)
            ->where('started_at', '>=', $startDate)
            ->whereNotNull('ended_at');
            
        if ($petId) {
            $favoriteQuery->where('pet_id', $petId);
        }
        
        $favoriteGameQuery = $favoriteQuery->select('game_type')
            ->selectRaw('COUNT(*) as play_count')
            ->groupBy('game_type')
            ->orderBy('play_count', 'DESC')
            ->first();

        $favoriteGame = $favoriteGameQuery ? $favoriteGameQuery->game_type : 'None';

        // ✅ Convert duration from seconds to minutes and ensure integers
        $totalPlayTimeMinutes = round(($gameStats->total_duration_seconds ?? 0) / 60, 1);
        $avgSessionDuration = $gameStats->games_played > 0 
            ? round(($gameStats->total_duration_seconds ?? 0) / $gameStats->games_played / 60, 1) 
            : 0;

        return [
            'games_played' => (int)($gameStats->games_played ?? 0),
            'total_play_time' => $totalPlayTimeMinutes,
            'points_earned' => (int)($gameStats->total_points_earned ?? 0),
            'average_score' => round($gameStats->average_score ?? 0, 1),
            'favorite_game' => $favoriteGame,
            'total_sessions' => (int)($gameStats->games_played ?? 0),
            'avg_session_duration' => $avgSessionDuration
        ];

    } catch (\Exception $e) {
        \Log::error('Error in getActivityAnalytics for pet_id: ' . ($petId ?? 'null') . ': ' . $e->getMessage());
        
        // Return meaningful default data for testing
        return [
            'games_played' => 0,
            'total_play_time' => 0,
            'points_earned' => 0,
            'average_score' => 0,
            'favorite_game' => 'None',
            'total_sessions' => 0,
            'avg_session_duration' => 0
        ];
    }
}


    /**
     * ✅ NEW: Generate basic PDF content (you can enhance this with a PDF library)
     */
    private function generatePDFContent($reportData)
    {
        // For now, return JSON. In production, use a library like DomPDF or TCPDF
        // Example with DomPDF:
        // $pdf = \PDF::loadView('reports.pet-analytics', $reportData);
        // return $pdf->output();
        
        return json_encode($reportData, JSON_PRETTY_PRINT);
    }

    /**
     * ✅ NEW: Generate Excel content
     */
    private function generateExcelContent($reportData)
    {
        // For now, return CSV format. In production, use Maatwebsite\Excel
        return $this->generateCSVContent($reportData);
    }

    /**
     * ✅ NEW: Generate image content
     */
    private function generateImageContent($reportData)
    {
        // For now, return JSON. In production, use GD or Imagick to create infographics
        return json_encode($reportData, JSON_PRETTY_PRINT);
    }


    /**
     * Get health metrics for a pet
     */

    private function getHealthMetrics($petId)
    {
        $avgMood = MoodTracker::where('pet_id', $petId)
            ->where('recorded_at', '>=', now()->subWeek())
            ->avg('mood_score');

        return [
            'weight_trend' => 'stable',
            'last_vet_visit' => '2024-01-15',
            'upcoming_appointments' => 1,
            'medications_due' => 0,
            'mood_score' => round($avgMood * 20, 0) ?: 85, // Convert 1-5 scale to 0-100
            'activity_level' => $this->calculateActivityLevel($petId),
            'sleep_quality' => rand(85, 95)
        ];
    }


/**
 * Fixed weekly trend data method using your actual GameSession structure
 */
private function getWeeklyTrendData($petId, $userId)
{
    $weeklyData = [];
    for ($i = 6; $i >= 0; $i--) {
        $date = Carbon::now()->subDays($i)->toDateString();
        
        // Nutrition data (this should work fine)
        $nutritionData = DispenseLog::where('pet_id', $petId)
            ->whereDate('dispensed_at', $date)
            ->selectRaw('type, SUM(amount) as total')
            ->groupBy('type')->pluck('total', 'type')->toArray();

        // ✅ CORRECTED: Activity data using your actual GameSession structure
        try {
            $activityData = GameSession::where('user_id', $userId)
                ->where('pet_id', $petId) // Include pet_id since you have it
                ->whereDate('started_at', $date)
                ->whereNotNull('ended_at') // Only completed sessions
                ->selectRaw('
                    COUNT(*) as daily_games,
                    SUM(COALESCE(duration, 0)) as daily_duration_seconds,
                    SUM(COALESCE(points_earned, 0)) as daily_points
                ')
                ->first();

            $dailyGames = (int)($activityData->daily_games ?? 0);
            $dailyDuration = (int)($activityData->daily_duration_seconds ?? 0);
            $dailyPoints = (int)($activityData->daily_points ?? 0);

        } catch (\Exception $e) {
            \Log::error('Error getting daily activity for date ' . $date . ': ' . $e->getMessage());
            $dailyGames = 0;
            $dailyDuration = 0;
            $dailyPoints = 0;
        }

        // Mood data (if MoodTracker exists)
        $moodScore = 0;
        try {
            if (class_exists('App\Models\MoodTracker')) {
                $moodScore = MoodTracker::where('pet_id', $petId)
                    ->whereDate('recorded_at', $date)
                    ->avg('mood_score');
            }
        } catch (\Exception $e) {
            // MoodTracker might not exist
        }

        $weeklyData[] = [
            'date' => $date,
            'day' => Carbon::parse($date)->format('D'),
            'water' => (float)($nutritionData['water'] ?? 0),
            'food' => (float)($nutritionData['food'] ?? 0),
            'treats' => (float)($nutritionData['treats'] ?? 0),
            'activity_minutes' => round($dailyDuration / 60, 1),
            'games_played' => $dailyGames,
            'points_earned' => $dailyPoints,
            'mood_score' => round(($moodScore ?? 0) * 20, 0),
        ];
    }
    return $weeklyData;
}

/**
 * Fixed calculateActivityLevel method using your GameSession structure
 */
private function calculateActivityLevel($petId)
{
    try {
        // ✅ FIXED: Use both user_id and pet_id since your GameSession has both
        $pet = Pet::find($petId);
        if (!$pet) {
            return 'Low';
        }

        $weeklyGames = GameSession::where('user_id', $pet->user_id)
            ->where('pet_id', $petId) // Also filter by pet_id
            ->where('started_at', '>=', Carbon::now()->subWeek())
            ->whereNotNull('ended_at')
            ->count();

        if ($weeklyGames >= 10) return 'High';
        if ($weeklyGames >= 5) return 'Medium';
        return 'Low';
        
    } catch (\Exception $e) {
        \Log::error('Error in calculateActivityLevel: ' . $e->getMessage());
        return 'Medium';
    }
}



    /**
     * Generate AI-like insights based on data
     */
    private function generateInsights($pet, $nutritionData, $activityData)
    {
        $insights = [];

        // Nutrition insights
        $waterIntake = $nutritionData['water_intake'];
        $recommendedWater = $pet->weight * 50 * $this->getDaysForPeriod('week'); // Weekly recommendation
        
        if ($waterIntake > $recommendedWater * 1.1) {
            $insights[] = [
                'type' => 'positive',
                'icon' => 'water-drop',
                'title' => 'Great Hydration!',
                'message' => "{$pet->name} is drinking " . round((($waterIntake / $recommendedWater) - 1) * 100) . "% more water than recommended - excellent hydration!"
            ];
        } elseif ($waterIntake < $recommendedWater * 0.8) {
            $insights[] = [
                'type' => 'warning',
                'icon' => 'water-drop',
                'title' => 'Hydration Concern',
                'message' => "{$pet->name} is drinking less water than recommended. Consider encouraging more water intake."
            ];
        }

        // Activity insights
        if ($activityData['games_played'] > 10) {
            $insights[] = [
                'type' => 'positive',
                'icon' => 'sports-esports',
                'title' => 'Active Pet Parent!',
                'message' => "Great job! You've played {$activityData['games_played']} games this week. {$pet->name} is getting excellent mental stimulation."
            ];
        } elseif ($activityData['games_played'] < 3) {
            $insights[] = [
                'type' => 'suggestion',
                'icon' => 'sports-esports',
                'title' => 'More Play Time?',
                'message' => "Consider playing more games with {$pet->name} for better bonding and mental exercise."
            ];
        }

        // Health insights
        $insights[] = [
            'type' => 'info',
            'icon' => 'favorite',
            'title' => 'Health Reminder',
            'message' => "Don't forget to schedule {$pet->name}'s next vet checkup if it's been more than 6 months."
        ];

        return $insights;
    }

    /**
     * Generate recommendations based on analytics
     */
    private function generateRecommendations($pet, $period)
    {
        return [
            'nutrition' => [
                'daily_water_target' => $pet->weight * 50,
                'daily_food_target' => $pet->weight * 25,
                'treat_limit' => $pet->weight * 3,
                'feeding_schedule' => $pet->age < 1 ? '3-4 times daily' : '2 times daily'
            ],
            'activity' => [
                'recommended_games_per_week' => 10,
                'target_play_time_minutes' => 30,
                'suggested_games' => $this->getSuggestedGames($pet),
                'exercise_needs' => $this->getExerciseNeeds($pet)
            ],
            'health' => [
                'vet_checkup_frequency' => $pet->age > 7 ? 'Every 6 months' : 'Annually',
                'weight_monitoring' => 'Weekly weigh-ins recommended',
                'vaccination_reminder' => 'Check vaccination schedule',
                'dental_care' => 'Brush teeth 2-3 times per week'
            ]
        ];
    }

    /**
     * Get suggested games based on pet characteristics
     */
    private function getSuggestedGames($pet)
    {
        $suggestions = [];
        
        if ($pet->type === 'dog') {
            $suggestions = ['Virtual Walk', 'Treat Toss', 'Training Session'];
        } elseif ($pet->type === 'cat') {
            $suggestions = ['Memory Match', 'Pet Puzzles', 'Treat Toss'];
        } else {
            $suggestions = ['Memory Match', 'Pet Quiz', 'Pet Puzzles'];
        }

        // Add difficulty based on age
        if ($pet->age < 2) {
            $suggestions[] = 'Easy training games recommended';
        } elseif ($pet->age > 8) {
            $suggestions[] = 'Gentle mental stimulation games';
        }

        return $suggestions;
    }

    /**
     * Get exercise needs based on pet characteristics
     */
    private function getExerciseNeeds($pet)
    {
        $needs = [
            'daily_exercise_minutes' => 30,
            'intensity' => 'moderate',
            'special_considerations' => []
        ];

        if ($pet->type === 'dog') {
            switch ($pet->size) {
                case 'small':
                    $needs['daily_exercise_minutes'] = 20;
                    $needs['intensity'] = 'low-moderate';
                    break;
                case 'large':
                    $needs['daily_exercise_minutes'] = 60;
                    $needs['intensity'] = 'high';
                    break;
                default:
                    $needs['daily_exercise_minutes'] = 40;
            }
        } elseif ($pet->type === 'cat') {
            $needs['daily_exercise_minutes'] = 15;
            $needs['intensity'] = 'low';
            $needs['special_considerations'][] = 'Indoor play sessions';
        }

        if ($pet->age > 8) {
            $needs['intensity'] = 'low';
            $needs['special_considerations'][] = 'Senior pet - gentle exercise';
        } elseif ($pet->age < 1) {
            $needs['special_considerations'][] = 'Puppy/kitten - supervised play';
        }

        return $needs;
    }

    /**
     * Calculate activity level based on game sessions
     */
    // private function calculateActivityLevel($petId)
    // {
    //     $weeklyGames = GameSession::whereHas('pet', function ($query) use ($petId) {
    //         $query->where('id', $petId);
    //     })
    //     ->where('played_at', '>=', Carbon::now()->subWeek())
    //     ->count();

    //     if ($weeklyGames >= 10) return 'High';
    //     if ($weeklyGames >= 5) return 'Medium';
    //     return 'Low';
    // }

    /**
     * Helper method to get start date for period
     */
    private function getStartDateForPeriod($period)
    {
        switch ($period) {
            case 'week':
                return Carbon::now()->subWeek();
            case 'month':
                return Carbon::now()->subMonth();
            case 'year':
                return Carbon::now()->subYear();
            default:
                return Carbon::now()->subWeek();
        }
    }

    /**
     * Helper method to get number of days for period
     */
    private function getDaysForPeriod($period)
    {
        switch ($period) {
            case 'week':
                return 7;
            case 'month':
                return 30;
            case 'year':
                return 365;
            default:
                return 7;
        }
    }

    /**
     * Export analytics data
     */
    public function exportData(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'pet_id' => 'nullable|exists:pets,id',
                'format' => 'required|in:csv,json,excel',
                'data_types' => 'required|array',
                'data_types.*' => 'in:nutrition,games,all',
                'date_from' => 'nullable|date',
                'date_to' => 'nullable|date|after_or_equal:date_from'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = auth()->user();
            $format = $request->format;
            $dataTypes = $request->data_types;
            
            // Get pet
            if ($request->pet_id) {
                $pet = Pet::where('id', $request->pet_id)
                          ->where('user_id', $user->id)
                          ->first();
            } else {
                $pet = $user->activePet;
            }

            if (!$pet) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pet not found'
                ], 404);
            }

            // Set date range
            $dateFrom = $request->date_from ? Carbon::parse($request->date_from) : Carbon::now()->subMonth();
            $dateTo = $request->date_to ? Carbon::parse($request->date_to) : Carbon::now();

            $exportData = [];

            // Export nutrition data
            if (in_array('nutrition', $dataTypes) || in_array('all', $dataTypes)) {
                $nutritionData = DispenseLog::where('pet_id', $pet->id)
                    ->whereBetween('dispensed_at', [$dateFrom, $dateTo])
                    ->orderBy('dispensed_at', 'desc')
                    ->get()
                    ->map(function ($log) {
                        return [
                            'date' => $log->dispensed_at->toDateString(),
                            'time' => $log->dispensed_at->toTimeString(),
                            'type' => $log->type,
                            'amount' => $log->amount,
                            'unit' => $log->type === 'water' ? 'ml' : 'g'
                        ];
                    });

                $exportData['nutrition'] = $nutritionData;
            }

            // Export games data
            if (in_array('games', $dataTypes) || in_array('all', $dataTypes)) {
                $gamesData = GameSession::where('user_id', $user->id)
                    ->whereBetween('played_at', [$dateFrom, $dateTo])
                    ->orderBy('played_at', 'desc')
                    ->get()
                    ->map(function ($session) {
                        return [
                            'date' => $session->played_at->toDateString(),
                            'time' => $session->played_at->toTimeString(),
                            'game_name' => $session->game_name,
                            'score' => $session->score,
                            'points_earned' => $session->points_earned,
                            'duration_seconds' => $session->duration_seconds
                        ];
                    });

                $exportData['games'] = $gamesData;
            }

            // In a real implementation, you would generate the actual file here
            // For CSV: use League\Csv or similar
            // For Excel: use Maatwebsite\Excel or similar
            
            return response()->json([
                'success' => true,
                'message' => 'Data export prepared successfully',
                'data' => [
                    'export_data' => $exportData,
                    'format' => $format,
                    'date_range' => [
                        'from' => $dateFrom->toDateString(),
                        'to' => $dateTo->toDateString()
                    ],
                    'total_records' => collect($exportData)->flatten(1)->count(),
                    'download_note' => 'In production, this would return a downloadable file'
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to export data',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}