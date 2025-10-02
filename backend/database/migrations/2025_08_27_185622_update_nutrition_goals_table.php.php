<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('pets', function (Blueprint $table) {
            $table->boolean('auto_dispense_enabled')->default(false);
            $table->integer('water_auto_threshold')->default(20); // Percentage
            $table->integer('food_auto_threshold')->default(20);
        });
    }

    public function down()
    {
        Schema::table('pets', function (Blueprint $table) {
            $table->dropColumn(['auto_dispense_enabled', 'water_auto_threshold', 'food_auto_threshold']);
        });
    }
};