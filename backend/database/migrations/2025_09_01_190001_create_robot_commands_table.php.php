<?php

// database/migrations/2024_01_01_000004_create_robot_commands_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('robot_commands', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('pet_id')->constrained()->onDelete('cascade');
            $table->string('command_type', 50); // move_forward, turn_left, etc.
            $table->text('command_data')->nullable(); // Voice command text or additional data
            $table->enum('status', ['pending', 'executing', 'completed', 'failed'])->default('pending');
            $table->timestamp('executed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
            
            $table->index(['user_id', 'pet_id']);
            $table->index(['command_type', 'status']);
            $table->index('executed_at');
        });
    }

    public function down()
    {
        Schema::dropIfExists('robot_commands');
    }
};
