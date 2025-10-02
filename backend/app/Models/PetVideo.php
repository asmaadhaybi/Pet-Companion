<?php
// Model: PetVideo.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class PetVideo extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'pet_id',
        'title',
        'description',
        'filename',
        'original_filename',
        'file_path',
        'thumbnail_path',
        'mime_type',
        'file_size',
        'duration',
        'metadata',
        'privacy',
        'is_favorite',
        'tags',
        'recorded_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'tags' => 'array',
        'is_favorite' => 'boolean',
        'recorded_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['video_url', 'thumbnail_url', 'formatted_duration', 'formatted_file_size'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }

    public function getVideoUrlAttribute()
    {
        return $this->file_path ? Storage::url($this->file_path) : null;
    }

    public function getThumbnailUrlAttribute()
    {
        return $this->thumbnail_path ? Storage::url($this->thumbnail_path) : null;
    }

    public function getFormattedDurationAttribute()
    {
        if (!$this->duration) return '0:00';
        
        $minutes = floor($this->duration / 60);
        $seconds = $this->duration % 60;
        return sprintf('%d:%02d', $minutes, $seconds);
    }

    public function getFormattedFileSizeAttribute()
    {
        $bytes = $this->file_size;
        if ($bytes >= 1073741824) {
            return number_format($bytes / 1073741824, 2) . ' GB';
        } elseif ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 2) . ' MB';
        } elseif ($bytes >= 1024) {
            return number_format($bytes / 1024, 2) . ' KB';
        } else {
            return $bytes . ' B';
        }
    }

    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeForPet($query, $petId)
    {
        return $query->where('pet_id', $petId);
    }

    public function scopeFavorites($query)
    {
        return $query->where('is_favorite', true);
    }

    public function scopeRecent($query, $days = 30)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    public function scopeSearch($query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('title', 'like', "%{$search}%")
              ->orWhere('description', 'like', "%{$search}%")
              ->orWhereJsonContains('tags', $search);
        });
    }
}
