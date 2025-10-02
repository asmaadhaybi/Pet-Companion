<?php
// app/Models/Order.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'order_number',
        'status',
        'total_amount',
        'discount_amount',
        'shipping_amount',
        'tax_amount',
        'points_used',
        'points_earned',
        'shipping_address',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'shipping_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'shipping_address' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($order) {
            $order->order_number = 'PW' . str_pad(mt_rand(1, 99999), 5, '0', STR_PAD_LEFT);
        });
    }

    // Order statuses
    public const STATUSES = [
        'pending' => 'Pending',
        'confirmed' => 'Confirmed',
        'processing' => 'Processing',
        'shipped' => 'Shipped',
        'delivered' => 'Delivered',
        'cancelled' => 'Cancelled',
    ];

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    // Scopes
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    // Methods
    public function getTotalItems()
    {
        return $this->orderItems()->sum('quantity');
    }

    public function canBeCancelled()
    {
        return in_array($this->status, ['pending', 'confirmed']);
    }
}