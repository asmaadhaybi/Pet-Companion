<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\GameSession;
use App\Models\RobotCommand;
use App\Models\SensorReading;
use App\Models\Pet;
use App\Models\User;
use App\Models\UserPoints;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GamesController extends Controller
{
    // Start a new game session
    public function startGame(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'pet_id' => 'required|exists:pets,id',
            'game_type' => 'required|in:basketball,cat_wand,robot_control,voice_command'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'validationErrors' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();
        $petId = $request->pet_id;

        // Verify pet belongs to user
        $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json([
                'success' => false,
                'error' => 'Pet not found or access denied'
            ], 404);
        }

        // End any existing active session for this user/pet/game_type
        GameSession::where('user_id', $userId)
            ->where('pet_id', $petId)
            ->where('game_type', $request->game_type)
            ->whereNull('ended_at')
            ->update(['ended_at' => now()]);

        $gameSession = GameSession::create([
            'user_id' => $userId,
            'pet_id' => $petId,
            'game_type' => $request->game_type,
            'score' => 0,
            'points_earned' => 0,
            'game_data' => $request->input('game_data') ?? [],
            'started_at' => now()
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'session_id' => $gameSession->id,
                'game_type' => $gameSession->game_type,
                'pet' => $pet,
                'message' => 'Game session started successfully'
            ]
        ]);
    }

    // Update game progress
    public function updateGameProgress(Request $request, $sessionId)
    {
        $validator = Validator::make($request->all(), [
            'current_score' => 'required|integer|min:0',
            'game_data' => 'nullable|array',
            'duration' => 'required|integer|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'error' => 'Validation failed', 'validationErrors' => $validator->errors()], 422);
        }

        $gameSession = GameSession::where('id', $sessionId)->where('user_id', Auth::id())->whereNull('ended_at')->first();

        if (!$gameSession) {
            return response()->json(['success' => false, 'error' => 'Active game session not found'], 404);
        }

        $pointsMultiplier = ['basketball' => 1, 'cat_wand' => 1];
        $newScore = $request->current_score;
        $scoreDifference = $newScore - $gameSession->score;
        $pointsEarned = max(0, $scoreDifference * ($pointsMultiplier[$gameSession->game_type] ?? 1));

        // Update session record
        $gameSession->score = $newScore;
        $gameSession->duration = $request->duration;
        $gameSession->points_earned += $pointsEarned;
        $gameSession->game_data = json_encode($request->game_data);
        $gameSession->last_updated_at = now();
        $gameSession->save();

        // Update user's total points
        $userPoints = UserPoints::firstOrCreate(['user_id' => Auth::id()], ['points' => 0]);
        if ($pointsEarned > 0) {
            $userPoints->increment('points', $pointsEarned);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'points_earned' => $pointsEarned,
                'total_session_points' => $gameSession->points_earned,
                'total_user_points' => $userPoints->fresh()->points,
            ]
        ]);
    }

    // End game session
    public function endGame(Request $request, $sessionId)
    {
        $gameSession = GameSession::where('id', $sessionId)
            ->where('user_id', Auth::id())
            ->whereNull('ended_at')
            ->first();

        if (!$gameSession) {
            return response()->json(['success' => false, 'error' => 'Active game session not found'], 404);
        }

        $finalScore = $request->input('final_score', $gameSession->score);
        $duration = $request->input('duration', $gameSession->duration);
        
        // No completion bonus as per your fix
        $completionBonus = 0;

        $gameSession->update([
            'score' => $finalScore,
            'duration' => $duration,
            'points_earned' => $gameSession->points_earned + $completionBonus,
            'ended_at' => now(),
            'status' => 'completed'
        ]);

        $userPoints = UserPoints::firstOrCreate(['user_id' => Auth::id()], ['points' => 0]);

        if ($completionBonus > 0) {
            $userPoints->increment('points', $completionBonus);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'session' => $gameSession->fresh(),
                'completion_bonus' => $completionBonus,
                'total_session_points' => $gameSession->points_earned,
                'total_user_points' => $userPoints->fresh()->points
            ]
        ]);
    }
/**
 * Get sensor readings for a specific pet
 */
public function getSensorReadings(Request $request, $petId)
{
    $userId = Auth::id();
    
    // Verify pet belongs to user
    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    if (!$pet) {
        return response()->json([
            'success' => false,
            'error' => 'Pet not found or access denied'
        ], 404);
    }

    $readings = SensorReading::where('pet_id', $petId)
        ->orderBy('recorded_at', 'desc')
        ->limit(50)
        ->get();

    $latestReading = $readings->first();
    
    return response()->json([
        'success' => true,
        'data' => [
            'latest' => $latestReading,
            'history' => $readings,
            'alerts' => $latestReading ? $latestReading->needsRefill() : []
        ]
    ]);
}

/**
 * Store new sensor reading
 */
public function storeSensorReading(Request $request)
{
    $validator = Validator::make($request->all(), [
        'pet_id' => 'required|exists:pets,id',
        'water_level' => 'required|integer|min:0|max:100',
        'food_level' => 'required|integer|min:0|max:100',
        'treats_level' => 'required|integer|min:0|max:100',
        'medication_level' => 'required|integer|min:0|max:100'
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'error' => 'Validation failed',
            'validationErrors' => $validator->errors()
        ], 422);
    }

    $userId = Auth::id();
    $petId = $request->pet_id;

    // Verify pet belongs to user
    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    if (!$pet) {
        return response()->json([
            'success' => false,
            'error' => 'Pet not found or access denied'
        ], 404);
    }

    $reading = SensorReading::create([
        'pet_id' => $petId,
        'water_level' => $request->water_level,
        'food_level' => $request->food_level,
        'treats_level' => $request->treats_level,
        'medication_level' => $request->medication_level,
        'recorded_at' => now()
    ]);

    $alerts = $reading->needsRefill();

    return response()->json([
        'success' => true,
        'data' => [
            'reading' => $reading,
            'alerts' => $alerts
        ]
    ]);
}

/**
 * Get sensor alerts for low levels
 */
public function getSensorAlerts(Request $request, $petId)
{
    $userId = Auth::id();
    
    // Verify pet belongs to user
    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    if (!$pet) {
        return response()->json([
            'success' => false,
            'error' => 'Pet not found or access denied'
        ], 404);
    }

    $latestReading = SensorReading::where('pet_id', $petId)
        ->orderBy('recorded_at', 'desc')
        ->first();

    if (!$latestReading) {
        return response()->json([
            'success' => true,
            'data' => [
                'alerts' => [],
                'message' => 'No sensor readings available'
            ]
        ]);
    }

    $alerts = $latestReading->needsRefill();
    
    return response()->json([
        'success' => true,
        'data' => [
            'alerts' => $alerts,
            'reading' => $latestReading,
            'pet' => $pet
        ]
    ]);
}

/**
 * Train a custom voice command
 */
public function trainVoiceCommand(Request $request)
{
    $validator = Validator::make($request->all(), [
        'pet_id' => 'required|exists:pets,id',
        'command_phrase' => 'required|string|max:255',
        'expected_action' => 'required|string',
        'audio_samples' => 'nullable|array'
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'error' => 'Validation failed',
            'validationErrors' => $validator->errors()
        ], 422);
    }

    $userId = Auth::id();
    $petId = $request->pet_id;

    // Verify pet belongs to user
    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    if (!$pet) {
        return response()->json([
            'success' => false,
            'error' => 'Pet not found or access denied'
        ], 404);
    }

    // Store custom command in database or cache
    // For now, we'll simulate the training process
    $trainingSuccess = rand(80, 100) > 10; // 90% success rate

    if ($trainingSuccess) {
        return response()->json([
            'success' => true,
            'data' => [
                'message' => 'Voice command trained successfully',
                'command_phrase' => $request->command_phrase,
                'expected_action' => $request->expected_action,
                'training_accuracy' => rand(85, 95) . '%'
            ]
        ]);
    } else {
        return response()->json([
            'success' => false,
            'error' => 'Voice command training failed. Please try again with clearer audio samples.'
        ], 400);
    }
}

/**
 * Get voice command library for a pet
 */
public function getVoiceCommandLibrary(Request $request)
{
    $petId = $request->input('pet_id');
    $userId = Auth::id();

    if ($petId) {
        $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json([
                'success' => false,
                'error' => 'Pet not found or access denied'
            ], 404);
        }
    }

    // Default command library
    $defaultCommands = [
        [
            'id' => 1,
            'phrase' => 'sit',
            'action' => 'play_sit_command',
            'type' => 'basic',
            'success_rate' => 95
        ],
        [
            'id' => 2,
            'phrase' => 'stay',
            'action' => 'play_stay_command',
            'type' => 'basic',
            'success_rate' => 90
        ],
        [
            'id' => 3,
            'phrase' => 'come here',
            'action' => 'play_come_command',
            'type' => 'basic',
            'success_rate' => 85
        ],
        [
            'id' => 4,
            'phrase' => 'treat',
            'action' => 'dispense_treat',
            'type' => 'reward',
            'success_rate' => 100
        ],
        [
            'id' => 5,
            'phrase' => 'good job',
            'action' => 'positive_reinforcement',
            'type' => 'praise',
            'success_rate' => 95
        ]
    ];

    return response()->json([
        'success' => true,
        'data' => [
            'commands' => $defaultCommands,
            'total_commands' => count($defaultCommands)
        ]
    ]);
}

/**
 * Emergency stop robot
 */
public function emergencyStopRobot(Request $request)
{
    $validator = Validator::make($request->all(), [
        'pet_id' => 'required|exists:pets,id',
        'reason' => 'nullable|string|max:255'
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'error' => 'Validation failed',
            'validationErrors' => $validator->errors()
        ], 422);
    }

    $userId = Auth::id();
    $petId = $request->pet_id;

    // Verify pet belongs to user
    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    if (!$pet) {
        return response()->json([
            'success' => false,
            'error' => 'Pet not found or access denied'
        ], 404);
    }

    // Cancel all pending commands for this pet
    RobotCommand::where('pet_id', $petId)
        ->where('user_id', $userId)
        ->where('status', 'pending')
        ->update([
            'status' => 'cancelled',
            'error_message' => 'Emergency stop activated',
            'completed_at' => now()
        ]);

    // Log emergency stop
    RobotCommand::create([
        'user_id' => $userId,
        'pet_id' => $petId,
        'command_type' => 'emergency_stop',
        'command_data' => $request->reason ?? 'Emergency stop activated',
        'status' => 'completed',
        'executed_at' => now(),
        'completed_at' => now()
    ]);

    return response()->json([
        'success' => true,
        'data' => [
            'message' => 'Emergency stop activated successfully',
            'cancelled_commands' => RobotCommand::where('pet_id', $petId)
                ->where('status', 'cancelled')
                ->count(),
            'pet' => $pet
        ]
    ]);
}

/**
 * Analyze pet behavior from image/video data
 */
public function analyzePetBehavior(Request $request)
{
    $validator = Validator::make($request->all(), [
        'pet_id' => 'required|exists:pets,id',
        'media_data' => 'required|string',
        'media_type' => 'required|in:image,video',
        'analysis_type' => 'required|in:movement,emotion,health,activity'
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'error' => 'Validation failed',
            'validationErrors' => $validator->errors()
        ], 422);
    }

    $userId = Auth::id();
    $petId = $request->pet_id;

    // Verify pet belongs to user
    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    if (!$pet) {
        return response()->json([
            'success' => false,
            'error' => 'Pet not found or access denied'
        ], 404);
    }

    // Simulate AI behavior analysis
    $analysisResults = $this->simulateBehaviorAnalysis($request->analysis_type, $pet);

    return response()->json([
        'success' => true,
        'data' => [
            'analysis' => $analysisResults,
            'pet' => $pet,
            'analysis_type' => $request->analysis_type,
            'media_type' => $request->media_type
        ]
    ]);
}

/**
 * Get detection history for a pet
 */
public function getDetectionHistory(Request $request, $petId)
{
    $userId = Auth::id();
    
    // Verify pet belongs to user
    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    if (!$pet) {
        return response()->json([
            'success' => false,
            'error' => 'Pet not found or access denied'
        ], 404);
    }

    // Get detection history from robot commands
    $detectionHistory = RobotCommand::where('pet_id', $petId)
        ->where('user_id', $userId)
        ->where('command_type', 'check_pet_movement')
        ->orderBy('created_at', 'desc')
        ->limit(50)
        ->get()
        ->map(function ($command) {
            $commandData = json_decode($command->command_data, true);
            return [
                'id' => $command->id,
                'detected_at' => $command->executed_at,
                'success' => $command->status === 'completed',
                'confidence' => $commandData['movement_confidence'] ?? 0,
                'detected_actions' => $commandData['detected_actions'] ?? [],
                'treat_dispensed' => $commandData['reason'] === 'successful_command_execution'
            ];
        });

    return response()->json([
        'success' => true,
        'data' => [
            'history' => $detectionHistory,
            'pet' => $pet,
            'total_detections' => $detectionHistory->count(),
            'successful_detections' => $detectionHistory->where('success', true)->count()
        ]
    ]);
}

/**
 * Get sensor data for a specific pet
 */
public function getSensorData($petId)
{
    $userId = Auth::id();
    
    // Verify pet belongs to user
    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    if (!$pet) {
        return response()->json([
            'success' => false,
            'error' => 'Pet not found or access denied'
        ], 404);
    }

    $latestReading = SensorReading::where('pet_id', $petId)
        ->orderBy('recorded_at', 'desc')
        ->first();

    if (!$latestReading) {
        // Return simulated data if no readings exist
        $sensorData = [
            'water_level' => rand(20, 90),
            'food_level' => rand(15, 85),
            'treats_level' => rand(10, 95),
            'medication_level' => rand(5, 80),
            'last_updated' => now(),
            'status' => 'simulated'
        ];
    } else {
        $sensorData = [
            'water_level' => $latestReading->water_level,
            'food_level' => $latestReading->food_level,
            'treats_level' => $latestReading->treats_level,
            'medication_level' => $latestReading->medication_level,
            'last_updated' => $latestReading->recorded_at,
            'status' => 'real',
            'alerts' => $latestReading->needsRefill()
        ];
    }

    return response()->json([
        'success' => true,
        'data' => [
            'sensor_data' => $sensorData,
            'pet' => $pet
        ]
    ]);
}

/**
 * Private helper for behavior analysis simulation
 */
private function simulateBehaviorAnalysis($analysisType, $pet)
{
    $baseResults = [
        'confidence' => rand(70, 95) / 100,
        'processing_time' => rand(1500, 3500),
        'pet_detected' => rand(80, 100) > 15
    ];

    switch ($analysisType) {
        case 'movement':
            return array_merge($baseResults, [
                'activity_level' => rand(30, 90),
                'movement_patterns' => ['walking', 'sitting', 'playing'],
                'energy_level' => rand(40, 100)
            ]);
            
        case 'emotion':
            $emotions = ['happy', 'excited', 'calm', 'curious', 'playful'];
            return array_merge($baseResults, [
                'primary_emotion' => $emotions[array_rand($emotions)],
                'emotion_confidence' => rand(60, 90),
                'stress_indicators' => rand(0, 30)
            ]);
            
        case 'health':
            return array_merge($baseResults, [
                'posture_score' => rand(70, 95),
                'movement_quality' => rand(75, 100),
                'alertness_level' => rand(80, 100),
                'health_flags' => []
            ]);
            
        case 'activity':
            $activities = ['eating', 'playing', 'resting', 'exploring', 'interacting'];
            return array_merge($baseResults, [
                'current_activity' => $activities[array_rand($activities)],
                'activity_duration' => rand(30, 600),
                'engagement_level' => rand(50, 100)
            ]);
            
        default:
            return $baseResults;
    }
}
    // Enhanced Robot Connection with real sensor integration
    public function connectRobot(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'pet_id' => 'required|exists:pets,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'validationErrors' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();
        $petId = $request->pet_id;

        // Verify pet belongs to user
        $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json([
                'success' => false,
                'error' => 'Pet not found or access denied'
            ], 404);
        }

        // Simulate robot connection and get sensor readings
        $batteryLevel = rand(70, 100);
        $connectionSuccess = true;

        // Get latest sensor readings for the pet
        $latestReading = SensorReading::where('pet_id', $petId)
            ->orderBy('recorded_at', 'desc')
            ->first();

        $sensorData = [
            'water_level' => $latestReading->water_level ?? rand(15, 90),
            'food_level' => $latestReading->food_level ?? rand(20, 85),
            'treats_level' => $latestReading->treats_level ?? rand(10, 95),
            'medication_level' => $latestReading->medication_level ?? rand(5, 80)
        ];

        if ($connectionSuccess) {
            return response()->json([
                'success' => true,
                'data' => [
                    'connected' => true,
                    'robot_id' => 'robot_' . $petId,
                    'battery_level' => $batteryLevel,
                    'sensor_data' => $sensorData,
                    'pet' => $pet,
                    'message' => 'Robot connected successfully'
                ]
            ]);
        } else {
            return response()->json([
                'success' => false,
                'error' => 'Failed to connect to robot'
            ], 500);
        }
    }

    // Enhanced Robot Command with AI detection
    public function sendRobotCommand(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'pet_id' => 'required|exists:pets,id',
            'command_type' => 'required|in:move_forward,move_backward,turn_left,turn_right,dispense_treat,play_sound,voice_command,check_pet_movement',
            'command_data' => 'nullable|string|max:255'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'validationErrors' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();
        $petId = $request->pet_id;

        // Verify pet belongs to user
        $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json([
                'success' => false,
                'error' => 'Pet not found or access denied'
            ], 404);
        }

        // Create robot command
        $robotCommand = RobotCommand::create([
            'user_id' => $userId,
            'pet_id' => $petId,
            'command_type' => $request->command_type,
            'command_data' => $request->command_data,
            'status' => 'pending',
            'executed_at' => now()
        ]);

        // Execute command and get result
        $executionResult = $this->executeRobotCommand($robotCommand);

        // Award points based on command type and success
        $pointsEarned = $this->calculateCommandPoints($request->command_type, $executionResult);
        
        // Update user points
        $userPoints = UserPoints::firstOrCreate(['user_id' => $userId], ['points' => 0]);
        $userPoints->increment('points', $pointsEarned);

        return response()->json([
            'success' => true,
            'data' => [
                'command' => $robotCommand->fresh(),
                'execution_result' => $executionResult,
                'points_earned' => $pointsEarned,
                'total_user_points' => $userPoints->fresh()->points,
                'pet' => $pet,
                'message' => 'Robot command sent successfully'
            ]
        ]);
    }

// In app/Http/Controllers/GamesController.php

public function processVoiceCommand(Request $request)
{
    $validator = Validator::make($request->all(), [
        'pet_id' => 'required|exists:pets,id',
        'command' => 'required|string|max:255', // This should now match your app
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false, 
            'error' => 'Validation failed', 
            'validationErrors' => $validator->errors()
        ], 422);
    }

    $userId = Auth::id();
    $petId = $request->pet_id;

    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    if (!$pet) {
        return response()->json(['success' => false, 'error' => 'Pet not found or access denied'], 404);
    }

    // THIS IS THE LINE TO FIX
    // It should pass both the command from the request AND the $pet object
    $analysis = $this->analyzeVoiceCommand($request->command, $pet);

    return response()->json([
        'success' => true,
        'data' => [
            'analysis' => $analysis,
            'message' => 'Command analyzed. Ready for pet movement check.'
        ]
    ]);
}
    // AI-powered pet movement detection
public function detectPetMovement(Request $request)
{
    $validator = Validator::make($request->all(), [
        'pet_id' => 'required|exists:pets,id',
        'command_action' => 'required|string',
        'image_data' => 'nullable|string',
    ]);

    if ($validator->fails()) {
        return response()->json(['success' => false, 'error' => 'Validation failed', 'validationErrors' => $validator->errors()], 422);
    }

    $userId = Auth::id();
    $petId = $request->pet_id;

    $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    if (!$pet) {
        return response()->json(['success' => false, 'error' => 'Pet not found'], 404);
    }
    
    $movementAnalysis = $this->analyzeMovement($request->image_data, $pet);
    $petSucceeded = $movementAnalysis['success'];
    $pointsEarned = 0;
    $userPoints = UserPoints::firstOrCreate(['user_id' => $userId], ['points' => 0]);
    
    if ($petSucceeded) {
        // ✅ FIX: First, create the command object
        $robotCommand = RobotCommand::create([
            'user_id' => $userId,
            'pet_id' => $petId,
            'command_type' => 'dispense_treat',
            'command_data' => json_encode(['reason' => 'pet_obeyed_voice_command']),
            'status' => 'pending'
        ]);
        
        // ✅ FIX: Then, pass the created object to the function
        $this->executeRobotCommand($robotCommand);

        $pointsEarned = 15;
        $userPoints->increment('points', $pointsEarned);
    }

    return response()->json([
        'success' => true,
        'data' => [
            'movement_detected' => $petSucceeded,
            'analysis' => $movementAnalysis,
            'treat_dispensed' => $petSucceeded,
            'points_earned' => $pointsEarned,
            'total_user_points' => $userPoints->fresh()->points,
        ]
    ]);
}
    // Get comprehensive game statistics
    public function getGameStats(Request $request)
    {
        $userId = Auth::id();
        $petId = $request->input('pet_id');

        $query = GameSession::where('user_id', $userId);

        if ($petId) {
            $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
            if (!$pet) {
                return response()->json([
                    'success' => false,
                    'error' => 'Pet not found or access denied'
                ], 404);
            }
            $query->where('pet_id', $petId);
        }

        // Initialize stats structure
        $stats = [
            'basketball' => ['bestScore' => 0, 'totalGames' => 0, 'totalPoints' => 0],
            'cat_wand' => ['bestScore' => 0, 'totalGames' => 0, 'totalPoints' => 0],
            'robot_control' => ['totalCommands' => 0, 'totalPoints' => 0],
            'voice_command' => ['totalCommands' => 0, 'successRate' => 0, 'totalPoints' => 0]
        ];

        // Basketball stats
        $basketballStats = GameSession::where('user_id', $userId)
            ->where('game_type', 'basketball')
            ->when($petId, function($q) use ($petId) {
                return $q->where('pet_id', $petId);
            })
            ->selectRaw('MAX(score) as best_score, COUNT(*) as total_games, SUM(points_earned) as total_points')
            ->first();

        if ($basketballStats) {
            $stats['basketball']['bestScore'] = $basketballStats->best_score ?? 0;
            $stats['basketball']['totalGames'] = $basketballStats->total_games ?? 0;
            $stats['basketball']['totalPoints'] = $basketballStats->total_points ?? 0;
        }

        // Cat wand stats
        $catWandStats = GameSession::where('user_id', $userId)
            ->where('game_type', 'cat_wand')
            ->when($petId, function($q) use ($petId) {
                return $q->where('pet_id', $petId);
            })
            ->selectRaw('MAX(score) as best_score, COUNT(*) as total_games, SUM(points_earned) as total_points')
            ->first();

        if ($catWandStats) {
            $stats['cat_wand']['bestScore'] = $catWandStats->best_score ?? 0;
            $stats['cat_wand']['totalGames'] = $catWandStats->total_games ?? 0;
            $stats['cat_wand']['totalPoints'] = $catWandStats->total_points ?? 0;
        }

        // Robot control stats
        $robotStats = RobotCommand::where('user_id', $userId)
            ->when($petId, function($q) use ($petId) {
                return $q->where('pet_id', $petId);
            })
            ->where('command_type', '!=', 'voice_command')
            ->selectRaw('COUNT(*) as total_commands, COUNT(CASE WHEN status = "completed" THEN 1 END) * 3 as total_points')
            ->first();

        if ($robotStats) {
            $stats['robot_control']['totalCommands'] = $robotStats->total_commands ?? 0;
            $stats['robot_control']['totalPoints'] = $robotStats->total_points ?? 0;
        }

        // Voice command stats
        $voiceStats = RobotCommand::where('user_id', $userId)
            ->when($petId, function($q) use ($petId) {
                return $q->where('pet_id', $petId);
            })
            ->where('command_type', 'voice_command')
            ->selectRaw('
                COUNT(*) as total_commands, 
                COUNT(CASE WHEN status = "completed" THEN 1 END) as successful_commands,
                COUNT(CASE WHEN status = "completed" THEN 1 END) * 5 as total_points
            ')
            ->first();

        if ($voiceStats) {
            $stats['voice_command']['totalCommands'] = $voiceStats->total_commands ?? 0;
            $stats['voice_command']['successRate'] = $voiceStats->total_commands > 0 
                ? round(($voiceStats->successful_commands / $voiceStats->total_commands) * 100, 1)
                : 0;
            $stats['voice_command']['totalPoints'] = $voiceStats->total_points ?? 0;
        }

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }

    // Private helper methods

    private function executeRobotCommand(RobotCommand $command)
    {
        // Update command status to executing
        $command->update(['status' => 'executing']);

        // Simulate command execution with realistic delays and results
        $success = rand(80, 100) > 15; // 85% success rate

        if ($success) {
            $result = [
                'success' => true,
                'execution_time' => rand(500, 2000), // milliseconds
                'battery_used' => rand(1, 5),
                'response' => $this->getCommandResponse($command->command_type)
            ];

            $command->update([
                'status' => 'completed',
                'completed_at' => now()
            ]);
        } else {
            $result = [
                'success' => false,
                'error' => 'Command execution failed',
                'retry_suggested' => true
            ];

            $command->update([
                'status' => 'failed',
                'error_message' => 'Execution timeout or hardware error',
                'completed_at' => now()
            ]);
        }

        return $result;
    }

    private function executeVoiceCommand(RobotCommand $command, $analysis)
    {
        $command->update(['status' => 'executing']);

        // Higher success rate for simpler commands
        $successRate = $analysis['confidence'] * 0.9;
        $success = (rand(1, 100) / 100) < $successRate;

        if ($success) {
            $result = [
                'success' => true,
                'action_taken' => $analysis['action'],
                'pet_response_detected' => rand(70, 100) > 25, // 75% chance pet responds
                'audio_played' => true,
                'execution_time' => rand(1000, 3000)
            ];

            $command->update([
                'status' => 'completed',
                'completed_at' => now()
            ]);
        } else {
            $result = [
                'success' => false,
                'error' => 'Voice command not recognized clearly',
                'suggested_rephrase' => $this->suggestRephrase($analysis['original_command'])
            ];

            $command->update([
                'status' => 'failed',
                'error_message' => 'Voice recognition failed',
                'completed_at' => now()
            ]);
        }

        return $result;
    }

    private function analyzeVoiceCommand($command, $pet)
    {
        $command = strtolower(trim($command));
        
        // Define command patterns and actions
        $patterns = [
            'sit' => ['action' => 'play_sit_command', 'confidence' => 0.95],
            'stay' => ['action' => 'play_stay_command', 'confidence' => 0.90],
            'come' => ['action' => 'play_come_command', 'confidence' => 0.85],
            'treat' => ['action' => 'dispense_treat', 'confidence' => 0.80],
            'play' => ['action' => 'play_sound', 'confidence' => 0.75],
            'good' => ['action' => 'positive_reinforcement', 'confidence' => 0.85],
            'move' => ['action' => 'move_forward', 'confidence' => 0.70]
        ];

        $bestMatch = ['action' => 'play_sound', 'confidence' => 0.5];
        
        foreach ($patterns as $pattern => $data) {
            if (strpos($command, $pattern) !== false) {
                $bestMatch = $data;
                break;
            }
        }

        // Adjust confidence based on pet type
        if ($pet->type === 'dog' && in_array($bestMatch['action'], ['play_sit_command', 'play_stay_command', 'play_come_command'])) {
            $bestMatch['confidence'] += 0.1;
        } elseif ($pet->type === 'cat' && in_array($bestMatch['action'], ['play_sound', 'dispense_treat'])) {
            $bestMatch['confidence'] += 0.05;
        }

        return [
            'original_command' => $command,
            'action' => $bestMatch['action'],
            'confidence' => min(0.95, $bestMatch['confidence']),
            'pet_type_optimized' => true
        ];
    }

    private function analyzeMovement($imageData, $pet)
    {
        // Simulate AI movement detection
        $confidence = rand(60, 95) / 100;
        $success = $confidence > 0.7;

        $detectedActions = [];
        if ($success) {
            $possibleActions = ['sitting', 'moving_toward_camera', 'looking_at_robot', 'tail_wagging', 'playing'];
            $detectedActions = array_slice($possibleActions, 0, rand(1, 3));
        }

        return [
            'success' => $success,
            'confidence' => $confidence,
            'detected_actions' => $detectedActions,
            'processing_time' => rand(800, 1500),
            'image_quality' => rand(70, 95)
        ];
    }

    private function calculateCommandPoints($commandType, $result)
    {
        if (!$result['success']) return 0;

        $basePoints = [
            'move_forward' => 3,
            'move_backward' => 3,
            'turn_left' => 3,
            'turn_right' => 3,
            'dispense_treat' => 5,
            'play_sound' => 4,
            'check_pet_movement' => 8
        ];

        return $basePoints[$commandType] ?? 3;
    }

    private function calculateVoiceCommandPoints($analysis, $result)
    {
        if (!$result['success']) return 0;

        $basePoints = 5;
        $confidenceBonus = round($analysis['confidence'] * 3);
        $responseBonus = $result['pet_response_detected'] ? 3 : 0;

        return $basePoints + $confidenceBonus + $responseBonus;
    }

    private function getCommandResponse($commandType)
    {
        $responses = [
            'move_forward' => 'Robot moved forward successfully',
            'move_backward' => 'Robot moved backward safely',
            'turn_left' => 'Robot turned left',
            'turn_right' => 'Robot turned right',
            'dispense_treat' => 'Treat dispensed for your pet',
            'play_sound' => 'Sound played to get pet attention',
        ];

        return $responses[$commandType] ?? 'Command executed';
    }

    private function suggestRephrase($command)
    {
        $suggestions = [
            'Try speaking more clearly',
            'Use simple commands like "sit", "stay", or "come"',
            'Make sure there is no background noise',
            'Try repeating the command'
        ];

        return $suggestions[array_rand($suggestions)];
    }

    // Get robot command history
    public function getRobotCommandHistory(Request $request)
    {
        $userId = Auth::id();
        $petId = $request->input('pet_id');

        $query = RobotCommand::where('user_id', $userId);

        if ($petId) {
            $query->where('pet_id', $petId);
        }

        $commands = $query->with('pet:id,name,type')
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json([
            'success' => true,
            'data' => $commands
        ]);
    }

    // Additional game methods (leaderboard, active games, etc.)
    public function getLeaderboard(Request $request)
    {
        $gameType = $request->input('game_type');
        
        $query = GameSession::select('user_id', 'pet_id')
            ->selectRaw('MAX(score) as best_score')
            ->selectRaw('COUNT(*) as total_games')
            ->selectRaw('SUM(points_earned) as total_points')
            ->with(['user:id,name,email', 'pet:id,name,type'])
            ->groupBy('user_id', 'pet_id');

        if ($gameType) {
            $query->where('game_type', $gameType);
        }

        $leaderboard = $query->orderBy('best_score', 'desc')
            ->limit(100)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $leaderboard
        ]);
    }

    public function getActiveGame(Request $request)
    {
        $userId = Auth::id();
        $petId = $request->input('pet_id');

        $query = GameSession::where('user_id', $userId)
            ->whereNull('ended_at')
            ->with('pet:id,name,type');

        if ($petId) {
            $query->where('pet_id', $petId);
        }

        $activeSession = $query->first();

        return response()->json([
            'success' => true,
            'data' => $activeSession
        ]);
    }
}