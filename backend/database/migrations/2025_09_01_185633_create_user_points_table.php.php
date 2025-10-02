<?php


use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('user_points', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            // This now represents the points for a single transaction
            $table->integer('points'); 
            
            // ✅ NEW COLUMNS ADDED
            $table->enum('type', ['purchase_reward', 'purchase_discount', 'bonus', 'referral', 'redemption', 'expired', 'game_reward', 'manual_adjustment']);
            $table->string('description')->nullable();
            $table->foreignId('order_id')->nullable()->constrained()->onDelete('set null');
            $table->timestamp('expires_at')->nullable();
            
            $table->timestamps();

            // ✅ REMOVED: The unique constraint is gone so a user can have many entries.
            // $table->unique('user_id'); 

            $table->index(['user_id', 'type']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('user_points');
    }
};




// // database/migrations/2024_01_01_000001_create_user_points_table.php
// use Illuminate\Database\Migrations\Migration;
// use Illuminate\Database\Schema\Blueprint;
// use Illuminate\Support\Facades\Schema;

// return new class extends Migration
// {
//     public function up()
//     {
//         Schema::create('user_points', function (Blueprint $table) {
//             $table->id();
//             $table->foreignId('user_id')->constrained()->onDelete('cascade');
//             $table->bigInteger('points')->default(0);
//             $table->timestamps();
            
//             $table->unique('user_id');
//             $table->index('points');
//         });
//     }

//     public function down()
//     {
//         Schema::dropIfExists('user_points');
//     }
// };