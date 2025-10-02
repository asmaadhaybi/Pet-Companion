<?php

namespace App\Models;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable;

    const ROLE_USER = 'user';
    const ROLE_ADMIN = 'admin';
    const ROLE_SUPER_ADMIN = 'super_admin';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'profile_picture',
        'preferences',
        'reset_token',
        'reset_token_expires_at',
        'points',
        'photo_url',
        'last_seen_at', // ✅ Add this



    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'reset_token',
        'email_verified_at' => 'datetime',
        // 'password' => 'hashed',
        // 'points' => 'integer'
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'reset_token_expires_at' => 'datetime',
        'last_seen_at' => 'datetime', // ✅ Add this
        'password' => 'hashed',
        'points' => 'integer'
    ];

    /**
     * Get the identifier that will be stored in the subject claim of the JWT.
     *
     * @return mixed
     */
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    /**
     * Return a key value array, containing any custom claims to be added to the JWT.
     *
     * @return array
     */
    public function getJWTCustomClaims()
    {
        return [
            'role' => $this->role,
        ];
    }

    /**
     * Relationship with pets
     */
    public function pets()
    {
        return $this->hasMany(Pet::class);
    }
    
    public function robotCommands()
    {
        return $this->hasMany(RobotCommand::class);
    }
    /**
     * Get the primary pet (first pet or most recently updated)
     */
    public function primaryPet()
    {
        return $this->pets()->latest('updated_at')->first();
    }

    /**
     * Check if user has a specific role
     */
    public function hasRole($role)
    {
        return $this->role === $role;
    }

    /**
     * Check if user is admin or super admin
     */
    public function isAdmin()
    {
        return in_array($this->role, [self::ROLE_ADMIN, self::ROLE_SUPER_ADMIN]);
    }

    /**
     * Check if user is super admin
     */
    public function isSuperAdmin()
    {
        return $this->role === self::ROLE_SUPER_ADMIN;
    }

    /**
     * Check if user is regular user
     */
    public function isUser()
    {
        return $this->role === self::ROLE_USER;
    }

    /**
     * Generate password reset token
     */
    public function generateResetToken()
    {
        $this->reset_token = bin2hex(random_bytes(32));
        $this->reset_token_expires_at = now()->addHours(1); // Token expires in 1 hour
        $this->save();
        
        return $this->reset_token;
    }
    
 public function activePet()
    {
        return $this->hasOne(Pet::class)->where('is_active', true);
    }

    public function dispenseLogs()
    {
        return $this->hasMany(DispenseLog::class);
    }

    public function gameSessions()
    {
        return $this->hasMany(GameSession::class);
    }

    public function pointHistory()
    {
        return $this->hasMany(UserPoint::class);
    }

    
    
    /**
     * Check if reset token is valid
     */
    public function isValidResetToken($token)
    {
        return $this->reset_token === $token && 
               $this->reset_token_expires_at && 
               $this->reset_token_expires_at->isFuture();
    }

    /**
     * Clear reset token
     */
    public function clearResetToken()
    {
        $this->reset_token = null;
        $this->reset_token_expires_at = null;
        $this->save();
    }

    public function userPoints()
    {
        return $this->hasOne(UserPoints::class);
    }

    public function pointsHistory()
    {
        return $this->hasMany(PointsHistory::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function createdProducts()
    {
        return $this->hasMany(Product::class, 'created_by');
    }

    // Add helper methods
    public function getPoints()
    {
        return $this->userPoints ? $this->userPoints->points : 0;
    }

    public function canManageProducts()
    {
        return $this->isAdmin() || $this->isSuperAdmin();
    }

    // Add points to user
    public function addPoints($points, $source, $description)
    {
        $this->increment('total_points', $points);
        
        return $this->pointHistory()->create([
            'points_earned' => $points,
            'source' => $source,
            'description' => $description
        ]);
    }
 /**
     * ✅ ADD THIS ENTIRE FUNCTION
     * Get the current points balance for the user.
     */
    public function getCurrentPointsBalance()
    {
        // This calculates the sum of all points transactions for the user
        return $this->hasMany(UserPoints::class)->sum('points');
    }
    /**
     * Get user profile with pet information
     */
   public function getProfileWithPets()
{
    // Load the user with pets relationship
    $user = $this->load('pets');
    
    // Build profile data
    $profile = [
        'id' => $this->id,
        'name' => $this->name,
        'email' => $this->email,
        'role' => $this->role,
        'profile_picture' => $this->profile_picture,
        'profile_picture_url' => $this->profile_picture ? url('storage/' . $this->profile_picture) : null,
        'preferences' => $this->preferences,
        'created_at' => $this->created_at,
        'updated_at' => $this->updated_at,
        'pets' => $this->pets->map(function ($pet) {
            return [
                'id' => $pet->id,
                'name' => $pet->name,
                'type' => $pet->type,
                'breed' => $pet->breed,
                'age' => $pet->age,
                'weight' => $pet->weight,
                'size' => $pet->size,
                'activity_level' => $pet->activity_level,
                'daily_food_amount' => $pet->daily_food_amount,
                'feeding_frequency' => $pet->feeding_frequency,
                'allergies' => $pet->allergies,
                'health_conditions' => $pet->health_conditions,
                'special_diet' => $pet->special_diet,
                'photo' => $pet->photo,
                'photo_url' => $pet->photo ? url('storage/' . $pet->photo) : null,
                'created_at' => $pet->created_at,
                'updated_at' => $pet->updated_at,
            ];
        })
    ];

    return $profile;
}

}