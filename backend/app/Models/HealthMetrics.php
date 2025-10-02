<?php

// app/Models/HealthMetrics.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HealthMetrics extends Model
{
    use HasFactory;

    protected $fillable = [
        'pet_id',
        'heart_rate',
        'oxygen_level',
        'blood_pressure_systolic',
        'blood_pressure_diastolic',
        'recorded_at'
    ];

    protected $casts = [
        'heart_rate' => 'integer',
        'oxygen_level' => 'integer',
        'blood_pressure_systolic' => 'integer',
        'blood_pressure_diastolic' => 'integer',
        'recorded_at' => 'datetime',
    ];

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }

    public function getHealthStatusAttribute()
    {
        $alerts = [];
        
        if ($this->heart_rate < 60 || $this->heart_rate > 100) {
            $alerts[] = 'Irregular heart rate';
        }
        
        if ($this->oxygen_level < 95) {
            $alerts[] = 'Low oxygen level';
        }
        
        if ($this->blood_pressure_systolic > 140 || $this->blood_pressure_diastolic > 90) {
            $alerts[] = 'High blood pressure';
        }
        
        return empty($alerts) ? 'Normal' : 'Alert: ' . implode(', ', $alerts);
    }
}