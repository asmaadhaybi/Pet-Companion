<?php
// app/Models/DispenseSchedule.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class DispenseSchedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'pet_id',
        'type',
        'amount',
        'schedule_time',
        'frequency',
        'days_of_week',
        'next_dispense',
        'is_active'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'days_of_week' => 'array',
        'next_dispense' => 'datetime',
        'is_active' => 'boolean',
        'schedule_time' => 'datetime:H:i'
    ];

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }

    public function dispenseLogs()
    {
        return $this->hasMany(DispenseLog::class);
    }

    public function updateNextDispense()
    {
        $now = Carbon::now();
        
        switch ($this->frequency) {
            case 'daily':
                $this->next_dispense = $now->copy()->addDay()->setTimeFromTimeString($this->schedule_time);
                break;
                
            case 'weekly':
                if ($this->days_of_week && !empty($this->days_of_week)) {
                    $nextDay = collect($this->days_of_week)->first(function ($day) use ($now) {
                        return $day >= $now->dayOfWeek;
                    });
                    
                    if ($nextDay === null) {
                        $nextDay = $this->days_of_week[0];
                        $this->next_dispense = $now->copy()->addWeek()->startOfWeek()->addDays($nextDay)->setTimeFromTimeString($this->schedule_time);
                    } else {
                        $this->next_dispense = $now->copy()->startOfWeek()->addDays($nextDay)->setTimeFromTimeString($this->schedule_time);
                    }
                } else {
                    $this->next_dispense = $now->copy()->addWeek()->setTimeFromTimeString($this->schedule_time);
                }
                break;
                
            case 'monthly':
                $this->next_dispense = $now->copy()->addMonth()->setTimeFromTimeString($this->schedule_time);
                break;
        }
        
        $this->save();
    }
}