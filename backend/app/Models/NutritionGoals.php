<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NutritionGoals extends Model
{
    use HasFactory;

    protected $table = 'nutrition_goals';

    protected $fillable = [
        'pet_id',
        'daily_calorie_goal',
        'daily_water_goal',
        'daily_treats_goal',
        'daily_medication_goal',
    ];

    protected $casts = [
        'daily_calorie_goal' => 'integer',
        'daily_water_goal' => 'integer',
        'daily_treats_goal' => 'integer',
        'daily_medication_goal' => 'integer',
    ];

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }
}