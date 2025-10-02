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
        Schema::table('user_points', function (Blueprint $table) {
            // Change the 'type' column to be a string with a 50 character limit
            $table->string('type', 50)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_points', function (Blueprint $table) {
            // This would revert the change if needed
            $table->string('type', 20)->nullable()->change(); // Assuming a smaller original size
        });
    }
};