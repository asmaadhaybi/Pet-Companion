<?php
// Model: RobotCommand.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RobotCommand extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'pet_id',
        'command_type',
        'command_data',
        'status',
        'executed_at',
        'completed_at',
        'error_message'
    ];

    protected $casts = [
        'executed_at' => 'datetime',
        'completed_at' => 'datetime'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }

    // Check if command is pending
    public function isPending()
    {
        return $this->status === 'pending';
    }

    // Check if command is completed
    public function isCompleted()
    {
        return $this->status === 'completed';
    }

    // Check if command failed
    public function isFailed()
    {
        return $this->status === 'failed';
    }
}