<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Pet extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'type',
        'breed',
        'age',
        'weight',
        'size',
        'activity_level',
        'daily_food_amount',
        'feeding_frequency',
        'special_diet',
        'allergies',
        'health_conditions',
        'photo',
        'birth_date',
        'microchip_number',
        'vaccination_records',
        'medical_history',
        'total_games_played',
        'total_play_time',
        'is_active', // Add this line
 'auto_dispense_enabled',
        
        // ✅ CHANGED: Use the correct column names from your database
        'water_auto_threshold',
        'food_auto_threshold',
        'last_game_at'
    ];

    protected $casts = [
        'age' => 'integer',
        'weight' => 'decimal:2',
        'daily_food_amount' => 'decimal:2',
        'feeding_frequency' => 'integer',
        'birth_date' => 'date',
        'vaccination_records' => 'array',
        'medical_history' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'last_game_at' => 'datetime',
        'is_active' => 'boolean', // Add this line


    ];

    protected $appends = [
        'photo_url',
        'age_in_months',
        'is_senior',
        'is_puppy_kitten',
        'bmi_status',
        'formatted_play_time', 'average_game_score'

    ];

    /**
     * Get the user that owns the pet.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

public function games()
    {
        return $this->hasMany(GameSession::class);
    }

    public function robotCommands()
    {
        return $this->hasMany(RobotCommand::class);
    }

    // Get pet's game statistics
    public function getGameStats()
    {
        return [
            'total_games' => $this->gameSessions()->count(),
            'total_points_earned' => $this->gameSessions()->sum('points_earned'),
            'favorite_game' => $this->gameSessions()
                ->select('game_type')
                ->selectRaw('COUNT(*) as game_count')
                ->groupBy('game_type')
                ->orderBy('game_count', 'desc')
                ->first()?->game_type,
            'best_scores' => $this->getBestScores()
        ];
    }

    private function getBestScores()
    {
        $gameTypes = ['basketball', 'cat_wand', 'robot_control', 'voice_command'];
        $bestScores = [];

        foreach ($gameTypes as $gameType) {
            $bestScores[$gameType] = $this->gameSessions()
                ->where('game_type', $gameType)
                ->max('score') ?? 0;
        }

        return $bestScores;
    }

    public function dispenseLogs()
    {
        return $this->hasMany(DispenseLog::class);
    }

    public function healthRecords()
    {
        return $this->hasMany(HealthRecord::class);
    }

    // Calculated properties
    public function getRecommendedWaterAttribute()
    {
        return $this->weight * 30; // 30ml per kg
    }

    public function getRecommendedTreatsAttribute()
    {
        return $this->weight * 2; // 2g per kg
    }

    public function getMealSizeAttribute()
    {
        return $this->daily_food_amount / $this->feeding_frequency;
    }

    /**
     * Get the photo URL attribute.
     */
    public function getPhotoUrlAttribute(): ?string
    {
        if ($this->photo) {
            return asset('storage/' . $this->photo);
        }
        return null;
    }

    /**
     * Get age in months.
     */
    public function getAgeInMonthsAttribute(): int
    {
        return $this->age * 12;
    }

    /**
     * Check if pet is senior.
     */
    public function getIsSeniorAttribute(): bool
    {
        return match($this->type) {
            'dog' => match($this->size) {
                'small' => $this->age >= 10,
                'medium' => $this->age >= 8,
                'large', 'extra_large' => $this->age >= 6,
                default => $this->age >= 7
            },
            'cat' => $this->age >= 7,
            'rabbit' => $this->age >= 5,
            'bird' => match($this->size) {
                'small' => $this->age >= 5,
                default => $this->age >= 8
            },
            default => $this->age >= 7
        };
    }


 

    public function pointTransactions(): HasMany
    {
        return $this->hasMany(PointTransaction::class);
    }

    public function getFormattedPlayTimeAttribute(): string
    {
        if (!$this->total_play_time) return '0:00';
        
        $hours = floor($this->total_play_time / 3600);
        $minutes = floor(($this->total_play_time % 3600) / 60);
        
        if ($hours > 0) {
            return sprintf('%dh %dm', $hours, $minutes);
        }
        
        return sprintf('%dm', $minutes);
    }

    public function getAverageGameScoreAttribute(): float
    {
        $completedGames = $this->games()->completed()->count();
        if ($completedGames === 0) return 0;
        
        return round($this->games()->completed()->avg('score'), 1);
    }

    // Game-related methods
    public function getActiveGame()
    {
        return $this->games()
            ->whereIn('status', ['active', 'paused'])
            ->latest()
            ->first();
    }

   
    public function getFavoriteGameType(): ?string
    {
        $gameTypeCounts = $this->games()
            ->completed()
            ->selectRaw('game_type, COUNT(*) as count')
            ->groupBy('game_type')
            ->orderByDesc('count')
            ->first();
            
        return $gameTypeCounts?->game_type;
    }

    public function getTodayStats()
    {
        $todayGames = $this->games()->today()->completed();
        
        return [
            'games_played' => $todayGames->count(),
            'points_earned' => $todayGames->sum(function($game) {
                return $game->game_data['total_points_earned'] ?? $game->score;
            }),
            'play_time' => $todayGames->sum('duration'),
            'best_score' => $todayGames->max('score'),
        ];
    }

    // Override save to maintain data consistency
    public function save(array $options = [])
    {
        // Ensure points never go negative
        if ($this->points < 0) {
            $this->points = 0;
        }
        
        return parent::save($options);
    }

    public function deletePhoto(Request $request, Pet $pet): JsonResponse
{
    // Authorization check
    if ($request->user()->id !== $pet->user_id) {
        return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
    }

    // If the pet has an existing photo, delete it
    if ($pet->photo) {
        Storage::disk('public')->delete($pet->photo);
        $pet->photo = null;
        $pet->save();
    }

    return response()->json([
        'success' => true,
        'message' => 'Photo deleted successfully!',
    ]);
}
    /**
     * Check if pet is puppy/kitten.
     */
    public function getIsPuppyKittenAttribute(): bool
    {
        return $this->age < 1;
    }

    /**
     * Get BMI status based on weight and size.
     */
    public function getBmiStatusAttribute(): string
    {
        $idealWeight = $this->getIdealWeightRange();
        
        if ($this->weight < $idealWeight['min']) {
            return 'underweight';
        } elseif ($this->weight > $idealWeight['max']) {
            return 'overweight';
        } else {
            return 'ideal';
        }
    }

    /**
     * Get ideal weight range for the pet.
     */
    public function getIdealWeightRange(): array
    {
        return match($this->type) {
            'dog' => match($this->size) {
                'small' => ['min' => 2, 'max' => 10],
                'medium' => ['min' => 10, 'max' => 25],
                'large' => ['min' => 25, 'max' => 45],
                'extra_large' => ['min' => 45, 'max' => 90],
                default => ['min' => 5, 'max' => 30]
            },
            'cat' => ['min' => 3, 'max' => 7],
            'rabbit' => ['min' => 1, 'max' => 5],
            'bird' => ['min' => 0.1, 'max' => 2],
            'fish' => ['min' => 0.01, 'max' => 1],
            'hamster' => ['min' => 0.1, 'max' => 0.3],
            default => ['min' => 1, 'max' => 10]
        };
    }

    /**
     * Calculate daily calorie needs.
     */
    public function getDailyCaloriesAttribute(): int
    {
        $baseCalories = $this->weight * 30; // Base metabolic rate
        
        // Adjust for activity level
        $activityMultiplier = match($this->activity_level) {
            'low' => 1.2,
            'moderate' => 1.5,
            'high' => 1.8,
            default => 1.5
        };
        
        $calories = $baseCalories * $activityMultiplier;
        
        // Adjust for age
        if ($this->is_senior) {
            $calories *= 0.9; // Senior pets need fewer calories
        } elseif ($this->is_puppy_kitten) {
            $calories *= 2; // Puppies/kittens need more calories
        }
        
        return (int) round($calories);
    }

    /**
     * Get feeding schedule.
     */
    public function getFeedingScheduleAttribute(): array
    {
        $mealSize = round($this->daily_food_amount / $this->feeding_frequency, 1);
        
        $times = match($this->feeding_frequency) {
            1 => ['08:00'],
            2 => ['08:00', '18:00'],
            3 => ['07:00', '13:00', '19:00'],
            4 => ['07:00', '12:00', '17:00', '21:00'],
            default => ['08:00', '18:00']
        };
        
        return [
            'meal_size_grams' => $mealSize,
            'feeding_times' => $times,
            'total_daily_grams' => $this->daily_food_amount
        ];
    }

    /**
     * Get water intake recommendation.
     */
    public function getDailyWaterIntakeAttribute(): int
    {
        // 30ml per kg for dogs/cats, adjust for other pets
        $baseWater = match($this->type) {
            'dog', 'cat' => $this->weight * 30,
            'rabbit' => $this->weight * 50,
            'bird' => $this->weight * 40,
            default => $this->weight * 30
        };
        
        return (int) round($baseWater);
    }

    /**
     * Get exercise recommendations.
     */
    public function getExerciseRecommendationAttribute(): array
    {
        $baseMinutes = match($this->type) {
            'dog' => match($this->size) {
                'small' => 30,
                'medium' => 60,
                'large' => 90,
                'extra_large' => 120,
                default => 60
            },
            'cat' => 20,
            'rabbit' => 30,
            'bird' => 60, // Flight time
            default => 15
        };

        $minutes = match($this->activity_level) {
            'low' => (int)($baseMinutes * 0.5),
            'moderate' => $baseMinutes,
            'high' => (int)($baseMinutes * 1.5),
            default => $baseMinutes
        };

        return [
            'daily_minutes' => $minutes,
            'sessions_per_day' => $this->activity_level === 'high' ? 3 : 2,
            'activities' => $this->getSuggestedActivities()
        ];
    }

    /**
     * Get suggested activities based on pet type.
     */
    private function getSuggestedActivities(): array
    {
        return match($this->type) {
            'dog' => ['Walking', 'Fetch', 'Swimming', 'Agility training', 'Running'],
            'cat' => ['Interactive toys', 'Climbing', 'Hunting games', 'Laser pointer', 'Feather wand'],
            'rabbit' => ['Hopping exercises', 'Tunnel play', 'Foraging', 'Free roam time'],
            'bird' => ['Flying time', 'Perch hopping', 'Toy interaction', 'Foraging'],
            'fish' => ['Swimming space', 'Environmental enrichment'],
            'hamster' => ['Wheel running', 'Tube exploration', 'Foraging'],
            default => ['Interactive play', 'Environmental enrichment']
        };
    }

    /**
     * Get health alerts based on pet data.
     */
    public function getHealthAlertsAttribute(): array
    {
        $alerts = [];
        
        if ($this->is_senior) {
            $alerts[] = [
                'type' => 'info',
                'message' => 'Senior pet - increased health monitoring recommended',
                'priority' => 'medium'
            ];
        }
        
        if ($this->bmi_status === 'overweight') {
            $alerts[] = [
                'type' => 'warning',
                'message' => 'Pet may be overweight - consider consulting vet about diet',
                'priority' => 'high'
            ];
        } elseif ($this->bmi_status === 'underweight') {
            $alerts[] = [
                'type' => 'warning',
                'message' => 'Pet may be underweight - consider increasing food intake',
                'priority' => 'high'
            ];
        }
        
        if ($this->health_conditions) {
            $alerts[] = [
                'type' => 'important',
                'message' => 'Monitor existing health conditions: ' . $this->health_conditions,
                'priority' => 'high'
            ];
        }
        
        if ($this->allergies) {
            $alerts[] = [
                'type' => 'caution',
                'message' => 'Avoid known allergens: ' . $this->allergies,
                'priority' => 'high'
            ];
        }
        
        return $alerts;
    }

    /**
     * Scope to filter pets by type.
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope to filter senior pets.
     */
    public function scopeSenior($query)
    {
        return $query->whereRaw('
            CASE 
                WHEN type = "dog" AND size = "small" THEN age >= 10
                WHEN type = "dog" AND size = "medium" THEN age >= 8
                WHEN type = "dog" AND (size = "large" OR size = "extra_large") THEN age >= 6
                WHEN type = "cat" THEN age >= 7
                WHEN type = "rabbit" THEN age >= 5
                ELSE age >= 7
            END
        ');
    }

    /**
     * Scope to filter young pets.
     */
    public function scopeYoung($query)
    {
        return $query->where('age', '<', 1);
    }

    /**
     * Get next vaccination due date.
     */
    public function getNextVaccinationDueAttribute(): ?string
    {
        if (!$this->vaccination_records || empty($this->vaccination_records)) {
            return 'Vaccination schedule needed';
        }
        
        // This would be more complex in real implementation
        // For now, assume annual vaccinations
        $lastVaccination = collect($this->vaccination_records)->sortByDesc('date')->first();
        
        if ($lastVaccination && isset($lastVaccination['date'])) {
            $nextDue = new \DateTime($lastVaccination['date']);
            $nextDue->add(new \DateInterval('P1Y')); // Add 1 year
            return $nextDue->format('Y-m-d');
        }
        
        return 'Schedule vaccination';
    }

    /**
     * Get grooming frequency recommendation.
     */
    public function getGroomingFrequencyAttribute(): string
    {
        return match($this->type) {
            'dog' => match($this->size) {
                'small' => 'Every 4-6 weeks',
                'medium' => 'Every 6-8 weeks',
                'large', 'extra_large' => 'Every 8-12 weeks',
                default => 'Every 6-8 weeks'
            },
            'cat' => 'Self-grooming, brush weekly',
            'rabbit' => 'Brush 2-3 times per week',
            'bird' => 'Bath 2-3 times per week',
            'hamster' => 'Sand baths as needed',
            default => 'As needed'
        };
    }
}