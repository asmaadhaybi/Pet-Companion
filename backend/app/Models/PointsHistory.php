<?php
// app/Models/PointsHistory.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PointsHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'points_change',
        'reason',
        'description',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}