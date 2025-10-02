<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\GamesController; // Corrected name
use App\Http\Controllers\NutritionController;
use App\Http\Controllers\HealthController;    // Added
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PetController;
use App\Http\Controllers\PointController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\UserPointsController;
use App\Http\Controllers\PetVideoController;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;


// Public routes (no authentication required)
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

// Protected routes (authentication required)
Route::middleware('auth:api')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::get('/me', [AuthController::class, 'me']);
    
// User level routes (all authenticated users)
Route::middleware(['auth:api', 'role:user'])->group(function () {
    Route::get('/dashboard', function () {
        return response()->json(['message' => 'User dashboard']);
    });
});

// Admin level routes (admin and super_admin)
Route::middleware(['auth:api', 'role:admin'])->group(function () {
    Route::get('/admin/reports', function () {
        return response()->json(['message' => 'Admin reports']);
    });
});

// Super admin only routes
Route::middleware(['auth:api', 'role:super_admin'])->group(function () {
    Route::put('/admin/users/{user}/role', [AuthController::class, 'updateRole']);
});
});

// Example of mixed access routes
Route::middleware(['auth:api', 'role:admin'])->group(function () {
    // Routes that require admin or super_admin access
    Route::get('/admin/reports', function () {
        return response()->json(['message' => 'Admin reports access']);
    });
});

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// Pet management routes
Route::middleware('auth:api')->group(function () {
    
    // User profile routes
// Profile management
    Route::get('/profile', [AuthController::class, 'getProfile']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::post('/profile/upload-image', [AuthController::class, 'uploadProfileImage']);
    Route::delete('/profile/image', [AuthController::class, 'removeProfileImage']);
    
    // User role management (super admin only)
    Route::put('/users/{userId}/role', [AuthController::class, 'updateRole'])->middleware('role:super_admin');

 
//games
// User Points Routes
    Route::prefix('user')->group(function () {
        Route::get('/points', [UserPointsController::class, 'getPoints']);
        Route::post('/points', [UserPointsController::class, 'updatePoints']);
        Route::post('/points/award', [UserPointsController::class, 'awardPoints']);
        Route::post('/points/spend', [UserPointsController::class, 'spendPoints']);
        // Route::get('/points/history', [UserPointsController::class, 'getPointsHistory']);
        // Route::get('/points/summary', [UserPointsController::class, 'getPointsSummary']);
    });

    // Game Routes
    Route::prefix('games')->group(function () {
        // Game session management
        Route::post('/start', [GamesController::class, 'startGame']);
        Route::put('/session/{sessionId}/progress', [GamesController::class, 'updateGameProgress']);
        Route::put('/session/{sessionId}/end', [GamesController::class, 'endGame']);
        
        // Game data retrieval
        Route::get('/history', [GamesController::class, 'getGameHistory']);
        Route::get('/stats', [GamesController::class, 'getGameStats']);
        Route::get('/leaderboard', [GamesController::class, 'getLeaderboard']);
        Route::get('/available', [GamesController::class, 'getAvailableGames']);
        Route::get('/active', [GamesController::class, 'getActiveGame']);
        
        // Direct game session creation (if needed)
        Route::post('/sessions', [GamesController::class, 'store']);
    });

// Enhanced Robot Control Routes
    Route::prefix('robot')->group(function () {
        Route::post('/connect', [GamesController::class, 'connectRobot']);
        Route::post('/command', [GamesController::class, 'sendRobotCommand']);
        Route::get('/commands/history', [GamesController::class, 'getRobotCommandHistory']);
        
        // New enhanced features
        Route::post('/voice-command', [GamesController::class, 'processVoiceCommand']);
        Route::post('/detect-movement', [GamesController::class, 'detectPetMovement']);
        Route::get('/sensor-data/{petId}', [GamesController::class, 'getSensorData']);
        Route::post('/emergency-stop', [GamesController::class, 'emergencyStopRobot']);
    });

    // Voice Command Routes
    Route::prefix('voice')->group(function () {
        Route::post('/process', [GamesController::class, 'processVoiceCommand']);
        Route::post('/train-command', [GamesController::class, 'trainVoiceCommand']);
        Route::get('/commands/library', [GamesController::class, 'getVoiceCommandLibrary']);
        Route::delete('/commands/{commandId}', [GamesController::class, 'deleteVoiceCommand']);
    });

    // Camera & AI Detection Routes
    Route::prefix('ai')->group(function () {
        Route::post('/detect-pet', [GamesController::class, 'detectPetMovement']);
        Route::post('/analyze-behavior', [GamesController::class, 'analyzePetBehavior']);
        Route::get('/detection-history/{petId}', [GamesController::class, 'getDetectionHistory']);
    });

    // Sensor Data Routes
    Route::prefix('sensors')->group(function () {
        Route::get('/readings/{petId}', [GamesController::class, 'getSensorReadings']);
        Route::post('/readings', [GamesController::class, 'storeSensorReading']);
        Route::get('/alerts/{petId}', [GamesController::class, 'getSensorAlerts']);
    });


    // Pet-specific game routes (alternative endpoints)
    Route::prefix('pets/{petId}')->group(function () {
        Route::get('/games', [GamesController::class, 'getGameHistory']);
        Route::get('/game-stats', [GamesController::class, 'getGameStats']);
        Route::get('/available-games', [GamesController::class, 'getAvailableGames']);
        Route::get('/active-game', [GamesController::class, 'getActiveGame']);
        Route::get('/points', [UserPointsController::class, 'getPetPoints']); 

    });
});

// Public routes (if any games features need to be accessible without auth)
Route::prefix('public')->group(function () {
    Route::get('/games/leaderboard', [GamesController::class, 'getLeaderboard']);

});
// Pet routes
    Route::prefix('pets')->group(function () {
        Route::get('/', [PetController::class, 'index']);
        Route::post('/', [PetController::class, 'store']);
        Route::get('/{id}', [PetController::class, 'show']);
        Route::put('/{id}', [PetController::class, 'update']);
        Route::delete('/{id}', [PetController::class, 'destroy']);
        Route::post('/{pet}/set-active', [PetController::class, 'setActive']);
        Route::get('/points', [UserPointsController::class, 'getPetPoints']);
        // ✅ NEW: Route to update auto-dispense settings
    Route::post('/{petId}/auto-dispense-settings', [PetController::class, 'updateAutoDispenseSettings']);

     
        // ✅ ADD THIS ROUTE FOR PET-SPECIFIC HISTORY
     Route::get('/points/history', [UserPointsController::class, 'getPetPointsHistory']);
        // Photo routes
        Route::post('/{id}/upload-photo', [PetController::class, 'uploadPhoto']);
        Route::delete('/{id}/delete-photo', [PetController::class, 'deletePhoto']);
        // Recommendation routes
        Route::get('/{id}/recommendations', [PetController::class, 'getRecommendations']);
        Route::get('/{id}/food-recommendations', [PetController::class, 'getFoodRecommendations']);
        Route::get('/{id}/feeding-schedule', [PetController::class, 'getFeedingSchedule']);
        Route::get('/{id}/exercise-recommendations', [PetController::class, 'getExerciseRecommendations']);
        Route::get('/{id}/health-tips', [PetController::class, 'getHealthTips']);
    });
        // Alias for compatibility
    Route::post('/save-info', [PetController::class, 'savePetInfo']);

    // --- Nutrition & Dispensing ---
    Route::prefix('nutrition')->group(function () {
        Route::post('/dispense/food', [NutritionController::class, 'dispenseFood']);
        Route::post('/dispense/water', [NutritionController::class, 'dispenseWater']);
        Route::post('/dispense/treats', [NutritionController::class, 'dispenseTreats']);
        Route::post('/dispense/medication', [NutritionController::class, 'dispenseMedication']);
        Route::get('/history', [NutritionController::class, 'getDispenseHistory']);
        Route::get('/stats', [NutritionController::class, 'getNutritionStats']);
        Route::get('/levels/{petId}', [NutritionController::class, 'getLevels']);
        Route::post('/levels/record', [NutritionController::class, 'recordLevels']);
        Route::get('/goals/{petId}', [NutritionController::class, 'getNutritionGoals']);
        Route::post('/goals/{petId}', [NutritionController::class, 'updateNutritionGoals']);
        
        // Schedule Routes
        Route::post('/schedule', [NutritionController::class, 'saveDispenseSchedule']);
        Route::get('/schedule/{petId}', [NutritionController::class, 'getDispenseSchedules']);
        Route::put('/schedule/{scheduleId}', [NutritionController::class, 'updateDispenseSchedule']);
        Route::delete('/schedule/{scheduleId}', [NutritionController::class, 'deleteDispenseSchedule']);
    });

     // ✨ NEW & CORRECTED: Health & Mood Routes
    Route::prefix('health')->group(function () {
        Route::post('/mood/record', [HealthController::class, 'recordMood']);
        Route::get('/stats', [HealthController::class, 'getHealthStats']);
        Route::get('/vitals/{petId}', [HealthController::class, 'getVitalSigns']);
        Route::get('/mood/history/{petId}', [HealthController::class, 'getMoodHistory']);

         // ✨ NEW: The route for the sensor to send data to
        Route::post('/vitals/record', [HealthController::class, 'recordVitalSigns']); 
    });
    //Analytics Route
    Route::prefix('analytics')->group(function () {
        Route::get('/', [AnalyticsController::class, 'getPetAnalytics']);
        Route::post('/generate-report', [AnalyticsController::class, 'generateReport']);
        Route::post('/export-data', [AnalyticsController::class, 'exportData']);
    });
    //Download Document Pdf or CSV
    Route::get('/test-storage', function () {
    try {
        $fileName = 'test_file.txt';
        $filePath = 'reports/' . $fileName;
        
        Storage::disk('public')->put($filePath, 'Hello World!');
        
        $exists = Storage::disk('public')->exists($filePath);
        if (!$exists) {
            return response()->json(['message' => 'File was not created! Check storage permissions.'], 500);
        }

        $url = Storage::disk('public')->url($filePath);
        
        return response()->json([
            'message' => 'Storage test successful!',
            'app_url_from_config' => config('app.url'),
            'generated_url' => $url,
            'file_exists' => $exists,
        ]);
    } catch (\Exception $e) {
        return response()->json(['message' => 'An error occurred.', 'error' => $e->getMessage()], 500);
    }
});



// Products
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    Route::get('/products/tiers/all', [ProductController::class, 'getTiers']);
    Route::post('/products', [ProductController::class, 'store'])->middleware('check_role:admin');
    Route::delete('/products/{id}', [ProductController::class, 'destroy'])->middleware('check_role:super_admin');

    // // Admin/Super Admin only product routes
    // Route::middleware('role:admin,super_admin')->group(function () {
    //    // Route::post('/products', [ProductController::class, 'store']);
    //     Route::put('/products/{id}', [ProductController::class, 'update']);
    //     Route::post('/products/{id}', [ProductController::class, 'update']); // For handling FormData updates
    //     //Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    // });

    // Cart
    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart', [CartController::class, 'store']);
    Route::put('/cart/{id}', [CartController::class, 'update']);
    Route::delete('/cart/{id}', [CartController::class, 'destroy']);
    Route::delete('/cart', [CartController::class, 'clear']);

    // Orders
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);

    // Points
    Route::get('/points', [UserPointsController::class, 'index']);
    Route::get('/points/balance', [UserPointsController::class, 'getBalance']);

    // // Super Admin only
    // Route::middleware('role:super_admin')->group(function () {
    //     Route::get('/admin/users', [UserController::class, 'index']);
    //     Route::put('/admin/users/{id}/role', [UserController::class, 'updateRole']);
    //     Route::get('/admin/orders', [OrderController::class, 'adminIndex']);
    //     Route::put('/admin/orders/{id}/status', [OrderController::class, 'updateStatus']);
    // });

// In routes/api.php

// --- Admin & Super Admin Routes ---
// ✅ USE 'role:admin,super_admin' HERE
Route::middleware(['auth:api'])->group(function () {
    
    // Product Management for Admins
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::post('/products/{id}', [ProductController::class, 'update']); // For FormData

    // Admin-specific routes for orders, users, etc.
    Route::prefix('admin')->name('admin.')->group(function () {
        Route::get('/orders', [OrderController::class, 'adminIndex'])->name('orders.index');
        Route::get('/orders/{id}', [OrderController::class, 'adminShow'])->name('orders.show');
        Route::post('/orders/{id}/status', [OrderController::class, 'updateStatus'])->name('orders.updateStatus');
    });
});

// ... your other routes

// --- Super Admin ONLY Routes ---
Route::middleware(['auth:api', 'role:super_admin'])->group(function () {
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);

    Route::prefix('admin')->name('admin.')->group(function () {
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::put('/users/{id}/role', [UserController::class, 'updateRole'])->name('users.updateRole');
    });
});


Route::middleware('auth:api')->group(function () {
    Route::prefix('videos')->group(function () {
        Route::get('/', [PetVideoController::class, 'index']);
        Route::post('/', [PetVideoController::class, 'store']);
        Route::get('/recent', [PetVideoController::class, 'recent']);
        Route::get('/stats', [PetVideoController::class, 'stats']);
        Route::get('/{id}', [PetVideoController::class, 'show']);
        Route::put('/{id}', [PetVideoController::class, 'update']);
        Route::delete('/{id}', [PetVideoController::class, 'destroy']);
        Route::post('/{id}/toggle-favorite', [PetVideoController::class, 'toggleFavorite']);
    });
});

