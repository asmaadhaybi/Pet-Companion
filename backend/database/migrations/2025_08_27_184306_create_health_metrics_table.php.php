<?php

// database/migrations/xxxx_create_health_metrics_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('health_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->onDelete('cascade');
            $table->integer('heart_rate')->nullable();
            $table->integer('oxygen_level')->nullable();
            $table->integer('blood_pressure_systolic')->nullable();
            $table->integer('blood_pressure_diastolic')->nullable();
            $table->timestamp('recorded_at');
            $table->timestamps();
            
            $table->index(['pet_id', 'recorded_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('health_metrics');
    }
};
