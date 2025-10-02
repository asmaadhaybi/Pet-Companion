<?php
// app/Models/MoodTracker.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MoodTracker extends Model
{
    use HasFactory;

    protected $fillable = [
        'pet_id',
        'mood',
        'mood_score',
        'recorded_date',
        'recorded_at',
        'notes'
    ];

    protected $casts = [
        'mood_score' => 'integer',
        'recorded_date' => 'date',
        'recorded_at' => 'datetime',
    ];

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }

    public function getMoodEmojiAttribute()
    {
        return match($this->mood) {
            'very_sad' => '😢',
            'sad' => '😞',
            'neutral' => '😐',
            'happy' => '😊',
            'very_happy' => '😁',
            default => '😐'
        };
    }
}