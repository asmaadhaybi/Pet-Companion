<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('mood_trackers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->onDelete('cascade');
            $table->enum('mood', ['very_sad', 'sad', 'neutral', 'happy', 'very_happy']);
            $table->integer('mood_score')->default(5);
            $table->date('recorded_date');
            $table->timestamp('recorded_at');
            $table->timestamps();
            $table->index(['pet_id', 'recorded_date']);

        });
    }

   public function down(): void
    {
               Schema::dropIfExists('mood_trackers');

    }
};