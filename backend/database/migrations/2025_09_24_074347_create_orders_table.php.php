<?php

// database/migrations/2024_01_01_000002_create_orders_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->string('order_number')->unique();
            $table->enum('status', ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])->default('pending');
            $table->decimal('total_amount', 10, 2);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('shipping_amount', 10, 2)->default(0);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->integer('points_used')->default(0);
            $table->integer('points_earned')->default(0);
            $table->json('shipping_address');
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('order_number');
            $table->index('status');
        });
    }

    public function down()
    {
        Schema::dropIfExists('orders');
    }
};
