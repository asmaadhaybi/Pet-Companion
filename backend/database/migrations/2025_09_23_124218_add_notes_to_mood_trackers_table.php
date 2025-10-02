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
        Schema::table('mood_trackers', function (Blueprint $table) {
            // Adds the new 'notes' column after the 'mood_score' column
            $table->text('notes')->nullable()->after('mood_score');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mood_trackers', function (Blueprint $table) {
            // Removes the column if you ever roll back this migration
            $table->dropColumn('notes');
        });
    }
};