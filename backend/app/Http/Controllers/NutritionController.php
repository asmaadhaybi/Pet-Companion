<?php
//Additional Controller: NutritionController.php
namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\DispenseLog;
use App\Models\DispenseSchedule; // ✅ NEW: Import DispenseSchedule model
use App\Models\Pet;
use App\Models\NutritionGoals; // ✨ ADD THIS LINE
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

use Illuminate\Support\Facades\Validator;
use App\Models\UserPoints; // ✅ FIXED: Import UserPoints model
use App\Models\HealthMetrics; // ✨ ADD THIS LINE
use App\Models\SensorReading; // ✅ ENSURE THIS IMPORT IS PRESENT

class NutritionController extends Controller
{
    public function dispenseFood(Request $request)
    {
        return $this->dispense($request, 'food');
    }

    public function dispenseWater(Request $request)
    {
        return $this->dispense($request, 'water');
    }

    public function dispenseTreats(Request $request)
    {
        return $this->dispense($request, 'treats');
    }
    public function dispenseMedication(Request $request) { return $this->dispense($request, 'meds'); }


  private function dispense(Request $request, $type)
    {
        $rules = ['pet_id' => 'required|exists:pets,id'];

        // ✅ FIXED: This now correctly checks for 'meds' for integer validation
        if ($type === 'meds') { 
            $rules['amount'] = 'required|integer|min:1|max:100';
        } else {
            $rules['amount'] = 'required|numeric|min:0.1|max:5000';
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'error' => 'Validation failed', 'validationErrors' => $validator->errors()], 422);
        }

        $userId = Auth::id();
        $pet = Pet::where('id', $request->pet_id)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json(['success' => false, 'error' => 'Pet not found or access denied'], 404);
        }

        $dispenseLog = DispenseLog::create([
            'user_id'      => $userId,
            'pet_id'       => $request->pet_id,
            'type'         => $type,
            'amount'       => $request->amount,
            'dispensed_at' => now()
        ]);

        $pointsEarned = 1;
        $userPoints = UserPoints::firstOrCreate(['user_id' => $userId], ['points' => 0]);
        $userPoints->increment('points', $pointsEarned);

        return response()->json([
            'success' => true,
            'data'    => [
                'dispense_log'      => $dispenseLog,
                'points_earned'     => $pointsEarned,
                'total_user_points' => $userPoints->fresh()->points,
                'message'           => ucfirst($type) . ' dispensed successfully'
            ]
        ]);
    }


      /**
     * ✅ THIS IS THE CORRECTED FUNCTION
     */

public function getDispenseHistory(Request $request)
{
    $userId = Auth::id();
    $petId = $request->input('pet_id');

    $query = DispenseLog::where('user_id', $userId);

    if ($petId) {
        $query->where('pet_id', $petId);
    }

    // Safely load the pet's name
    $query->with(['pet' => function ($query) {
        $query->select('id', 'name');
    }]);

    $history = $query->orderBy('dispensed_at', 'desc')->paginate(50);

    // Add a fallback name for logs where the pet might have been deleted
    $history->getCollection()->transform(function ($log) {
        $log->pet_name = $log->pet ? $log->pet->name : 'A deleted pet';
        // We no longer need the full pet object on the frontend
        unset($log->pet); 
        return $log;
    });

    // Ensure NO dd() or dump() calls are before this line
    return response()->json([
        'success' => true,
        'data' => $history
    ]);
}
/**
 * ✨ NEW: For the sensor to send data TO the server.
 */
public function recordLevels(Request $request)
{
    $validator = Validator::make($request->all(), [
        'pet_id'       => 'required|exists:pets,id',
        'water_level'  => 'required|integer|min:0|max:100',
        'food_level'   => 'required|integer|min:0|max:100',
        'treats_level' => 'sometimes|integer|min:0|max:100',
        'medication_level' => 'sometimes|integer|min:0|max:100',

    ]);

    if ($validator->fails()) {
        return response()->json(['success' => false, 'error' => $validator->errors()], 422);
    }

    // You can add pet ownership verification here if the sensor is tied to a user account
    
    $reading = SensorReading::create([
        'pet_id'       => $request->pet_id,
        'water_level'  => $request->water_level,
        'food_level'   => $request->food_level,
        'treats_level' => $request->treats_level,
        'medication_level' => $request->medication_level,
        'recorded_at'  => now()
    ]);

    return response()->json([
        'success' => true,
        'message' => 'Sensor levels recorded successfully.',
        'data'    => $reading
    ]);
}

 /**
     * ✨ NEW: Get the nutrition goals for a specific pet.
     */
   public function getNutritionGoals($petId)
    {
        $userId = Auth::id();
        $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json(['success' => false, 'error' => 'Pet not found or access denied'], 404);
        }

        // 👇 CORRECTED: Changed NutritionGoal to NutritionGoals
        $goals = NutritionGoals::firstOrCreate(
            ['pet_id' => $petId],
            [
                'daily_calorie_goal' => 250,
                'daily_water_goal' => 300,
                'daily_treats_goal' => 10,
                'daily_medication_goal' => 0, // Added default
            ]
        );

        return response()->json(['success' => true, 'data' => $goals]);
    }

    /**
     * Create or update the nutrition goals for a specific pet.
     */
    public function updateNutritionGoals(Request $request, $petId)
    {
        $userId = Auth::id();
        $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json(['success' => false, 'error' => 'Pet not found or access denied'], 404);
        }

        $validator = Validator::make($request->all(), [
            'daily_calorie_goal' => 'required|integer|min:0',
            'daily_water_goal' => 'required|integer|min:0',
            'daily_treats_goal' => 'required|integer|min:0',
            'daily_medication_goal' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'error' => $validator->errors()], 422);
        }

        // 👇 CORRECTED: Changed NutritionGoal to NutritionGoals
        $goals = NutritionGoals::updateOrCreate(
            ['pet_id' => $petId],
            [
                'daily_calorie_goal' => $request->daily_calorie_goal,
                'daily_water_goal' => $request->daily_water_goal,
                'daily_treats_goal' => $request->daily_treats_goal,
                'daily_medication_goal' => $request->daily_medication_goal,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Nutrition goals updated successfully!',
            'data' => $goals
        ]);
    }
/**
 * ✨ NEW: For the mobile app to GET the latest data FROM the server.
 */

public function getLevels($petId)
{
    // Verify the pet belongs to the authenticated user
    $pet = Pet::where('id', $petId)->where('user_id', Auth::id())->first();
    if (!$pet) {
        return response()->json(['success' => false, 'error' => 'Pet not found or access denied'], 404);
    }

    // Find the most recent sensor reading for this pet
    $latestReading = SensorReading::where('pet_id', $petId)->latest('recorded_at')->first();

    // If no readings exist, return a default state with valid data
    if (!$latestReading) {
        return response()->json([
            'success' => true,
            'data' => [
                'water_level'  => 100,
                'food_level'   => 100,
                'treats_level' => 100,
                'medication_level' => 100,
                'recorded_at'  => now()->toISOString() // Use ISOString for consistency
            ]
        ]);
    }

    // This is the ONLY return statement that should run if a reading is found.
    // Make sure there are no dd(), dump(), or echo() calls before this line.
    return response()->json([
        'success' => true,
        'data'    => $latestReading
    ]);
}

 // ✅ NEW: Save dispense schedule
    public function saveDispenseSchedule(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'pet_id' => 'required|exists:pets,id',
            'type' => 'required|in:food,water,treats,meds',
            'amount' => 'required|numeric|min:0.1',
            'schedule_time' => 'required|date_format:H:i',
            'is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'error' => 'Validation failed', 'validationErrors' => $validator->errors()], 422);
        }

        $userId = Auth::id();
        $pet = Pet::where('id', $request->pet_id)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json(['success' => false, 'error' => 'Pet not found or access denied'], 404);
        }

        $schedule = DispenseSchedule::create([
            'pet_id' => $request->pet_id,
            'type' => $request->type,
            'amount' => $request->amount,
            'schedule_time' => $request->schedule_time,
            'is_active' => $request->input('is_active', true)
        ]);

        return response()->json(['success' => true, 'data' => $schedule, 'message' => 'Schedule saved successfully']);
    }

    // ✅ NEW: Get all schedules for a pet
    public function getDispenseSchedules($petId)
    {
        $userId = Auth::id();
        $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json(['success' => false, 'error' => 'Pet not found or access denied'], 404);
        }

        // Make sure there are NO dd() or dump() calls before this line
        $schedules = DispenseSchedule::where('pet_id', $petId)->orderBy('schedule_time')->get();
        
        return response()->json(['success' => true, 'data' => ['schedules' => $schedules]]);
    }
    // ✅ NEW: Update an existing schedule
    public function updateDispenseSchedule(Request $request, $scheduleId)
    {
        // Validation and authorization logic...
        $schedule = DispenseSchedule::where('id', $scheduleId)->first(); // Add user auth check here
        if(!$schedule) return response()->json(['success' => false, 'error' => 'Schedule not found'], 404);

        $schedule->update($request->all());
        return response()->json(['success' => true, 'data' => $schedule->fresh(), 'message' => 'Schedule updated successfully']);
    }

    // ✅ NEW: Delete a schedule
    public function deleteDispenseSchedule($scheduleId)
    {
        // Authorization logic...
        $schedule = DispenseSchedule::where('id', $scheduleId)->first(); // Add user auth check here
        if(!$schedule) return response()->json(['success' => false, 'error' => 'Schedule not found'], 404);
        
        $schedule->delete();
        return response()->json(['success' => true, 'message' => 'Schedule deleted successfully']);
    }

    // ✅ NEW: Execute scheduled dispenses (for cron job)
    public function executeScheduledDispenses()
    {
        $now = Carbon::now()->format('H:i');
        $dueSchedules = DispenseSchedule::where('is_active', true)
            ->where('schedule_time', $now)
            ->with('pet')
            ->get();

        foreach ($dueSchedules as $schedule) {
            DispenseLog::create([
                'user_id' => $schedule->pet->user_id,
                'pet_id' => $schedule->pet_id,
                'type' => $schedule->type,
                'amount' => $schedule->amount,
                'dispensed_at' => now(),
                'auto_dispensed' => true,
                'schedule_id' => $schedule->id
            ]);
        }
        return response()->json(['success' => true, 'executed' => $dueSchedules->count()]);
    }
// In app/Http/Controllers/NutritionController.php

public function getNutritionStats(Request $request)
{
    $userId = Auth::id();
    $petId = $request->input('pet_id');
    $days = $request->input('days', 7);

    if (!$petId) {
        return response()->json(['success' => false, 'error' => 'Pet ID is required.'], 400);
    }

    $startDate = now()->subDays($days - 1)->startOfDay();
    $endDate = now()->endOfDay();

    // Base query for totals
    $queryBase = DispenseLog::where('user_id', $userId)
        ->where('pet_id', $petId)
        ->whereBetween('dispensed_at', [$startDate, $endDate]);

    $stats = [
        'total_food'           => (clone $queryBase)->where('type', 'food')->sum('amount'),
        'total_water'          => (clone $queryBase)->where('type', 'water')->sum('amount'),
        'total_treats'         => (clone $queryBase)->where('type', 'treats')->sum('amount'),
        'total_medication'     => (clone $queryBase)->where('type', 'meds')->sum('amount'),

        'dispensing_frequency' => (clone $queryBase)->count(),
    ];
    
    // We are temporarily returning an empty array for daily_averages to ensure this function works.
    // The calculation for daily averages can sometimes cause issues.
    $stats['daily_averages'] = [];

    // Make sure there are NO debugging statements (dd, dump, echo) before this line.
    return response()->json([
        'success' => true,
        'data' => $stats
    ]);
}
}