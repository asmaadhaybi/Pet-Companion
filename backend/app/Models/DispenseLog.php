<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DispenseLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'pet_id',
        'type',
        'amount',
        'dispensed_at'
    ];

    protected $casts = [
        'dispensed_at' => 'datetime',
        'amount' => 'decimal:2'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }
}