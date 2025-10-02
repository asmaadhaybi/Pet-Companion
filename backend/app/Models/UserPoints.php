<?php
// app/Models/UserPoints.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserPoints extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'points',
        'type',
        'description',
        'order_id',
        'expires_at',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'expires_at' => 'datetime',
    ];

    /**
     * Relationships
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Static method to add points as a new transaction.
     */
    public static function addPoints($userId, $points, $type, $description = null, $orderId = null)
    {
        return self::create([
            'user_id' => $userId,
            'points' => abs($points), // Ensure points are positive
            'type' => $type,
            'description' => $description,
            'order_id' => $orderId,
            'expires_at' => now()->addYear(), // Points expire after 1 year
        ]);
    }

    /**
     * Static method to deduct points as a new transaction.
     */
    public static function deductPoints($userId, $points, $type, $description = null, $orderId = null)
    {
        // First, check if the user has enough points
        $currentBalance = self::getUserBalance($userId);
        if ($currentBalance < $points) {
            return false; // Not enough points
        }
        
        return self::create([
            'user_id' => $userId,
            'points' => -abs($points), // Ensure points are negative for deduction
            'type' => $type,
            'description' => $description,
            'order_id' => $orderId,
        ]);
    }

    /**
     * ✅ NEW: Calculate the user's current total points balance from the log.
     */
    public static function getUserBalance($userId)
    {
        // Sum all transactions for the user
        return self::where('user_id', $userId)->sum('points');
    }
}
