<?php
// app/Models/SensorReading.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SensorReading extends Model
{
    use HasFactory;

    protected $fillable = [
        'pet_id',
        'water_level',
        'food_level',
        'treats_level',
        'medication_level',
        'recorded_at'
    ];

    protected $casts = [
        'water_level' => 'integer',
        'food_level' => 'integer',
        'treats_level' => 'integer',
        'medication_level' => 'integer',
        'recorded_at' => 'datetime',
    ];

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }

    public function needsRefill()
    {
        $pet = $this->pet;
        $alerts = [];
        
        if ($this->water_level <= ($pet->water_auto_threshold ?? 20)) {
            $alerts[] = 'water';
        }
        
        if ($this->food_level <= ($pet->food_auto_threshold ?? 20)) {
            $alerts[] = 'food';
        }
        
        if ($this->treats_level <= 10) {
            $alerts[] = 'treats';
        }
        
        if ($this->medication_level <= 10) {
            $alerts[] = 'medication';
        }
        
        return $alerts;
    }
}
