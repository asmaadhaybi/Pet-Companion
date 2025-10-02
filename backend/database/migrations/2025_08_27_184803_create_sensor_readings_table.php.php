<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('sensor_readings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->onDelete('cascade');
            $table->integer('water_level')->default(100); // Percentage
            $table->integer('food_level')->default(100);
            $table->integer('treats_level')->default(100);
            $table->integer('medication_level')->default(100);
            $table->timestamp('recorded_at');
            $table->timestamps();
            
            $table->index(['pet_id', 'recorded_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('sensor_readings');
    }
};