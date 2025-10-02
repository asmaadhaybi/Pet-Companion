<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

//Migration: create_dispense_logs_table.php
class CreateDispenseLogsTable extends Migration
{
    public function up()
    {
        Schema::create('dispense_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('pet_id')->constrained()->onDelete('cascade');
            $table->enum('type', ['food', 'water', 'treats']);
            $table->decimal('amount', 8, 2); // amount in grams or ml
            $table->timestamp('dispensed_at');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('dispense_logs');
    }
}