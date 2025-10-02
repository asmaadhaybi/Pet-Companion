<?php

// Migration: create_pet_videos_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePetVideosTable extends Migration
{
    public function up()
    {
        Schema::create('pet_videos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('pet_id')->nullable();
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->string('filename');
            $table->string('original_filename');
            $table->string('file_path');
            $table->string('thumbnail_path')->nullable();
            $table->string('mime_type')->default('video/mp4');
            $table->bigInteger('file_size')->default(0); // in bytes
            $table->integer('duration')->default(0); // in seconds
            $table->json('metadata')->nullable(); // resolution, fps, etc.
            $table->enum('privacy', ['private', 'public', 'friends'])->default('private');
            $table->boolean('is_favorite')->default(false);
            $table->json('tags')->nullable(); // searchable tags
            $table->timestamp('recorded_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('pet_id')->references('id')->on('pets')->onDelete('set null');
            
            $table->index(['user_id', 'created_at']);
            $table->index(['pet_id', 'created_at']);
            $table->index('is_favorite');
            $table->index('recorded_at');
        });
    }

    public function down()
    {
        Schema::dropIfExists('pet_videos');
    }
}