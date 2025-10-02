<?php

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
        Schema::create('nutrition_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->onDelete('cascade');

            // Define all your goal columns here
            // I've added some examples based on your column names
            $table->integer('daily_calorie_goal')->default(0);
            $table->integer('daily_water_goal')->default(0);
            $table->integer('daily_treats_goal')->default(0);
            $table->integer('daily_medication_goal')->default(0); // The column from the error

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('nutrition_goals');
    }
};