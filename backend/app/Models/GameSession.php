<?php
// Models/GameSession.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GameSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'pet_id',
        'game_type',
        'score',
        'duration',
        'points_earned',
        'game_data',
        'started_at',
        'ended_at',
        'last_updated_at',
        'status',

    ];

    protected $casts = [
        'score' => 'integer',
        'duration' => 'integer',
        'points_earned' => 'integer',
        'game_data' => 'array',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'last_updated_at' => 'datetime'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }

    // Check if game session is active
    public function isActive()
    {
        return is_null($this->ended_at);
    }
     public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    // Calculate session duration in minutes
    public function getDurationInMinutes()
    {
        if ($this->ended_at && $this->started_at) {
            return $this->started_at->diffInMinutes($this->ended_at);
        }
        return 0;
    }
}