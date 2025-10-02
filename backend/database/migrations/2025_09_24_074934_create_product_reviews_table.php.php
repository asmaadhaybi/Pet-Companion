<?php

// database/migrations/2024_01_01_000006_create_product_reviews_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->foreignId('order_item_id')->nullable()->constrained();
            $table->integer('rating')->between(1, 5);
            $table->string('title')->nullable();
            $table->text('comment')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->timestamps();

            $table->index(['product_id', 'is_verified']);
            $table->unique(['user_id', 'order_item_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('product_reviews');
    }
};
