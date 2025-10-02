<?php
// app/Models/Product.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'price',
        'original_price',
        'stock_quantity',
        'tier',
        'category',
        'images',
        'features',
        'points_required',
        'discount_percentage',
        'is_active',
        'is_featured',
        'rating',
        'reviews_count',
        'created_by',
    ];

    protected $casts = [
        'images' => 'array',
        'features' => 'array',
        'price' => 'decimal:2',
        'original_price' => 'decimal:2',
        'discount_percentage' => 'decimal:2',
        'rating' => 'decimal:1',
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
    ];

    protected $appends = ['tier_color', 'tier_icon'];

    // Tier definitions
    public const TIERS = [
        'automated' => [
            'label' => 'Automated PawPal',
            'color' => '#4ECDC4',
            'icon' => 'schedule',
            'description' => 'Basic feeding & hydration'
        ],
        'intelligent' => [
            'label' => 'Intelligent PawPal',
            'color' => '#45B7D1',
            'icon' => 'psychology',
            'description' => 'AI-powered with interactive features'
        ],
        'luxury' => [
            'label' => 'Luxury PawPal',
            'color' => '#C066E3',
            'icon' => 'diamond',
            'description' => 'Premium customizable experience'
        ]
    ];

    // Relationships
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    public function scopeByTier($query, $tier)
    {
        return $query->where('tier', $tier);
    }

    public function scopeInStock($query)
    {
        return $query->where('stock_quantity', '>', 0);
    }

    // Accessors
    public function getTierColorAttribute()
    {
        return self::TIERS[$this->tier]['color'] ?? '#257D8C';
    }

    public function getTierIconAttribute()
    {
        return self::TIERS[$this->tier]['icon'] ?? 'pets';
    }

    public function getTierLabelAttribute()
    {
        return self::TIERS[$this->tier]['label'] ?? ucfirst($this->tier);
    }

    // Methods
    public function getDiscountedPrice($userPoints = 0)
    {
        if ($this->points_required > 0 && $userPoints >= $this->points_required) {
            return $this->price * (1 - $this->discount_percentage / 100);
        }
        return $this->price;
    }

    public function canUsePointsDiscount($userPoints)
    {
        return $this->points_required > 0 && $userPoints >= $this->points_required;
    }

    public function decrementStock($quantity)
    {
        if ($this->stock_quantity >= $quantity) {
            $this->decrement('stock_quantity', $quantity);
            return true;
        }
        return false;
    }

    public function incrementStock($quantity)
    {
        $this->increment('stock_quantity', $quantity);
    }

    public function updateRating()
    {
        $reviews = $this->reviews();
        $this->rating = $reviews->avg('rating');
        $this->reviews_count = $reviews->count();
        $this->save();
    }

    public function isInStock()
    {
        return $this->stock_quantity > 0;
    }

    public function getStockStatus()
    {
        if ($this->stock_quantity <= 0) {
            return 'out_of_stock';
        } elseif ($this->stock_quantity <= 5) {
            return 'low_stock';
        }
        return 'in_stock';
    }
}