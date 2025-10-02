<?php
// database/migrations/2024_01_01_000001_create_products_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description');
            $table->decimal('price', 10, 2);
            $table->decimal('original_price', 10, 2)->nullable();
            $table->integer('stock_quantity')->default(0);
            $table->enum('tier', ['automated', 'intelligent', 'luxury']);
            $table->string('category');
            $table->json('images')->nullable();
            $table->json('features')->nullable();
            $table->integer('points_required')->default(0);
            $table->decimal('discount_percentage', 5, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->decimal('rating', 3, 1)->nullable();
            $table->integer('reviews_count')->default(0);
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tier', 'is_active']);
            $table->index(['is_featured', 'is_active']);
            $table->index('created_by');
        });
    }

    public function down()
    {
        Schema::dropIfExists('products');
    }
};