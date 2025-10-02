<?php

namespace App\Http\Controllers;
use App\Models\Pet; // Import the Pet model
use App\Http\Controllers\Controller;
use App\Models\UserPoints;
//use App\Models\PointsHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class UserPointsController extends Controller
{
    // Get user's current points
    public function getPoints()
    {
        $userId = Auth::id();
        $userPoints = UserPoints::firstOrCreate(['user_id' => $userId], ['points' => 0]);

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $userId,
                'points' => $userPoints->points,
                'last_updated' => $userPoints->updated_at
            ]
        ]);
    }

    // Award points for specific actions
    public function awardPoints(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'points' => 'required|integer|min:1',
            'action' => 'required|string|max:100',
            'source' => 'nullable|string|max:100'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'validationErrors' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();
        $pointsToAdd = $request->points;
        $action = $request->action;
        $source = $request->input('source', 'game');

        $userPoints = UserPoints::firstOrCreate(['user_id' => $userId], ['points' => 0]);
        $previousTotal = $userPoints->points;

        $userPoints->increment('points', $pointsToAdd);
        $newTotal = $userPoints->fresh()->points;

       /* PointsHistory::create([
            'user_id' => $userId,
            'points_change' => $pointsToAdd,
            'reason' => $action,
            'source' => $source,
            'previous_total' => $previousTotal,
            'new_total' => $newTotal
        ]);*/

        return response()->json([
            'success' => true,
            'data' => [
                'points_awarded' => $pointsToAdd,
                'total_points' => $newTotal,
                'action' => $action,
                'message' => "Awarded {$pointsToAdd} points for {$action}"
            ]
        ]);
    }
   
   public function getPetPoints($petId)
    {
        $userId = Auth::id();
        
        // Ensure the pet belongs to the authenticated user for security
        $pet = \App\Models\Pet::where('id', $petId)->where('user_id', $userId)->first();
        if (!$pet) {
            return response()->json(['success' => false, 'error' => 'Pet not found or unauthorized.'], 404);
        }

        $petPoints = UserPoints::firstOrCreate(
            ['user_id' => $userId, 'pet_id' => $petId],
            ['points' => 0]
        );

        return response()->json([
            'success' => true,
            'data' => [
                'pet_id' => (int)$petId,
                'points' => $petPoints->points,
            ]
        ]);
    }

       /**
     * ✅ NEW METHOD: Get points history for a specific pet.
     */
    // public function getPetPointsHistory(Request $request, $petId)
    // {
    //     $userId = Auth::id();
    //     $limit = $request->input('limit', 50);

    //     // Verify pet belongs to the user
    //     $pet = Pet::where('id', $petId)->where('user_id', $userId)->first();
    //     if (!$pet) {
    //         return response()->json([
    //             'success' => false,
    //             'error' => 'Pet not found or access denied'
    //         ], 404);
    //     }

    //     $history = PointsHistory::where('user_id', $userId)
    //         ->where('pet_id', $petId) // Filter by pet_id
    //         ->orderBy('created_at', 'desc')
    //         ->limit($limit)
    //         ->get();

    //     return response()->json([
    //         'success' => true,
    //         'data' => $history
    //     ]);
    // }

    // Spend points (for rewards/purchases)
    public function spendPoints(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'points' => 'required|integer|min:1',
            'item' => 'required|string|max:100',
            'description' => 'nullable|string|max:255'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'validationErrors' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();
        $pointsToSpend = $request->points;
        $item = $request->item;
        $description = $request->input('description', '');

        $userPoints = UserPoints::where('user_id', $userId)->first();

        if (!$userPoints || $userPoints->points < $pointsToSpend) {
            return response()->json([
                'success' => false,
                'error' => 'Insufficient points',
                'current_points' => $userPoints ? $userPoints->points : 0,
                'required_points' => $pointsToSpend
            ], 400);
        }

        $previousTotal = $userPoints->points;

        $userPoints->decrement('points', $pointsToSpend);
        $newTotal = $userPoints->fresh()->points;

        // PointsHistory::create([
        //     'user_id' => $userId,
        //     'points_change' => -$pointsToSpend,
        //     'reason' => "Purchased: {$item}",
        //     'source' => 'purchase',
        //     'previous_total' => $previousTotal,
        //     'new_total' => $newTotal,
        //     'metadata' => json_encode(['item' => $item, 'description' => $description])
        // ]);

        return response()->json([
            'success' => true,
            'data' => [
                'points_spent' => $pointsToSpend,
                'total_points' => $newTotal,
                'item_purchased' => $item,
                'message' => "Successfully purchased {$item} for {$pointsToSpend} points"
            ]
        ]);
    }

    // Get points summary
    // public function getPointsSummary()
    // {
    //     $userId = Auth::id();
    //     $userPoints = UserPoints::firstOrCreate(['user_id' => $userId], ['points' => 0]);

    //     $weeklyEarned = PointsHistory::where('user_id', $userId)
    //         ->where('points_change', '>', 0)
    //         ->where('created_at', '>=', now()->subDays(7))
    //         ->sum('points_change');

    //     $weeklySpent = PointsHistory::where('user_id', $userId)
    //         ->where('points_change', '<', 0)
    //         ->where('created_at', '>=', now()->subDays(7))
    //         ->sum('points_change');

    //     $totalEarned = PointsHistory::where('user_id', $userId)
    //         ->where('points_change', '>', 0)
    //         ->sum('points_change');

    //     $topSources = PointsHistory::where('user_id', $userId)
    //         ->where('points_change', '>', 0)
    //         ->selectRaw('source, SUM(points_change) as total_points')
    //         ->groupBy('source')
    //         ->orderBy('total_points', 'desc')
    //         ->limit(5)
    //         ->get();

    //     return response()->json([
    //         'success' => true,
    //         'data' => [
    //             'current_points' => $userPoints->points,
    //             'weekly_earned' => $weeklyEarned,
    //             'weekly_spent' => abs($weeklySpent),
    //             'total_lifetime_earned' => $totalEarned,
    //             'top_earning_sources' => $topSources,
    //             'last_updated' => $userPoints->updated_at
    //         ]
    //     ]);
    // }

    // Update user points (manual adjustment)
    public function updatePoints(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'points' => 'required|integer',
            'reason' => 'nullable|string|max:255',
            'source' => 'nullable|string|max:100'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'validationErrors' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();
        $pointsChange = $request->points;
        $reason = $request->input('reason', 'Manual update');
        $source = $request->input('source', 'app');

        $userPoints = UserPoints::firstOrCreate(['user_id' => $userId], ['points' => 0]);

        $newTotal = max(0, $userPoints->points + $pointsChange);
        $actualChange = $newTotal - $userPoints->points;

        $userPoints->update(['points' => $newTotal]);

        if ($actualChange != 0) {
            // PointsHistory::create([
            //     'user_id' => $userId,
            //     'points_change' => $actualChange,
            //     'reason' => $reason,
            //     'source' => $source,
            //     'previous_total' => $userPoints->points - $actualChange,
            //     'new_total' => $newTotal
            // ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'points_change' => $actualChange,
                'total_points' => $newTotal,
                'reason' => $reason,
                'message' => $actualChange > 0 ? 'Points added successfully' : 'Points deducted successfully'
            ]
        ]);
    }

    // Get points history
    // public function getPointsHistory(Request $request)
    // {
    //     $userId = Auth::id();
    //     $limit = $request->input('limit', 50);

    //     $history = PointsHistory::where('user_id', $userId)
    //         ->orderBy('created_at', 'desc')
    //         ->limit($limit)
    //         ->get();

    //     return response()->json([
    //         'success' => true,
    //         'data' => $history
    //     ]);
    // }

    public function index()
    {
        try {
            $user = Auth::user();
            $currentBalance = $user->getCurrentPointsBalance();
            
            $history = UserPoints::where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->paginate(20);

            return response()->json([
                'status' => 'success',
                'success' => true,
                'data' => [
                    'current_balance' => $currentBalance,
                    'history' => $history
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Failed to fetch points data'
            ], 500);
        }
    }


    /**
     * Get the user's current total points balance from their single record.
     */
    public function getBalance(Request $request)
    {
        try {
            $user = $request->user();
            
            // Find the user's single points record, or create it with 0 points if it's their first time.
            $userPoints = UserPoints::firstOrCreate(
                ['user_id' => $user->id],
                ['points' => 0]
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'points' => $userPoints->points
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred while fetching points balance.'
            ], 500);
        }
    }
}