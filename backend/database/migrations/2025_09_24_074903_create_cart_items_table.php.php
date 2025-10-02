<?php

// database/migrations/2024_01_01_000005_create_cart_items_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('cart_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->integer('quantity');
            $table->boolean('use_points')->default(false);
            $table->timestamps();

            $table->unique(['user_id', 'product_id']);
            $table->index('user_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('cart_items');
    }
};