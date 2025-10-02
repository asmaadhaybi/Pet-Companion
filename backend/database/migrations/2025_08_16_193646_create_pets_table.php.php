<?php
// database/migrations/create_pets_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('pets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            // Basic information
            $table->string('name');
            $table->enum('type', ['dog', 'cat', 'bird', 'fish', 'rabbit', 'hamster', 'other']);
            $table->string('breed');
            $table->integer('age'); // in years
            $table->decimal('weight', 5, 2); // in kg, up to 999.99kg
            $table->enum('size', ['small', 'medium', 'large', 'extra_large']);
            
            // Activity and diet
            $table->enum('activity_level', ['low', 'moderate', 'high']);
            $table->decimal('daily_food_amount', 6, 2); // in grams, up to 9999.99g
            $table->integer('feeding_frequency')->default(2); // meals per day
            $table->enum('special_diet', [
                'none', 
                'grain-free', 
                'raw', 
                'prescription', 
                'senior', 
                'weight-management', 
                'puppy-kitten'
            ])->default('none');
            
            // Health information
            $table->text('allergies')->nullable();
            $table->text('health_conditions')->nullable();
            
            // Optional fields
            $table->string('photo')->nullable(); // FIX #1: Removed ->after()
            $table->date('birth_date')->nullable();
            $table->string('microchip_number')->nullable();
            $table->json('vaccination_records')->nullable(); // JSON array of vaccinations
            $table->json('medical_history')->nullable(); // JSON array of medical events
            
            $table->timestamps();
            
            // Indexes
            $table->index(['user_id', 'created_at']);
            $table->index(['type', 'size']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // FIX #2: This is the only line needed here.
        Schema::dropIfExists('pets');
    }
};