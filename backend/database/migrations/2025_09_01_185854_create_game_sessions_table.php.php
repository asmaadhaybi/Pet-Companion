<?php

// database/migrations/2024_01_01_000003_create_game_sessions_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('game_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('pet_id')->constrained()->onDelete('cascade');
            $table->string('game_type', 50);
            $table->integer('score')->default(0);
            $table->integer('duration')->nullable();
            $table->integer('points_earned')->default(0);
            $table->json('game_data')->nullable();
            
            // ✅ UPDATED: The status is now an enum with a default of 'pending'
            $table->enum('status', ['pending', 'in_progress', 'completed'])->default('pending');

            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamp('last_updated_at')->nullable();
            $table->timestamps();
            
            $table->index(['user_id', 'pet_id']);
            $table->index(['game_type', 'score']);
            $table->index('started_at');
        });
    }

    public function down()
    {
        Schema::dropIfExists('game_sessions');
    }
};