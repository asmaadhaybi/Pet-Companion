<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('dispense_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->onDelete('cascade');
            $table->enum('type', ['water', 'food', 'treats', 'medication']);
            $table->decimal('amount', 8, 2);
            $table->time('schedule_time');
            $table->enum('frequency', ['daily', 'weekly', 'monthly']);
            $table->json('days_of_week')->nullable(); // For weekly schedules [0=Sunday, 1=Monday, etc.]
            $table->timestamp('next_dispense');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index(['pet_id', 'is_active', 'next_dispense']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('dispense_schedules');
    }
};