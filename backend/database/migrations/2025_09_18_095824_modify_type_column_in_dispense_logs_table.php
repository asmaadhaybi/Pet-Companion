<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // This command assumes your existing types are 'food', 'water', 'treats', and 'meds'.
        // It safely adds 'medication' to the list of allowed values.
        DB::statement("ALTER TABLE dispense_logs MODIFY COLUMN type ENUM('food', 'water', 'treats', 'meds', 'medication') NOT NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This will revert the change if you ever need to roll back the migration.
        DB::statement("ALTER TABLE dispense_logs MODIFY COLUMN type ENUM('food', 'water', 'treats', 'meds') NOT NULL");
    }
};