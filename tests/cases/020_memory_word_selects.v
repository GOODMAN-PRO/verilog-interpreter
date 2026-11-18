module tb;
  reg [15:0] memory [0:3];
  reg [0:15] ascending [0:1];
  integer word_index, bit_index;
  initial begin
    memory[0] = 16'h1234;
    memory[1] = 16'habcd;
    ascending[0] = 16'habcd;
    word_index = 1;
    bit_index = 4;
    $display("read %b %h %h %h", memory[word_index][7], memory[word_index][11:4], memory[word_index][bit_index +: 4], ascending[0][bit_index +: 4]);
    memory[word_index][bit_index +: 4] = 4'h5;
    memory[0][11:8] = 4'he;
    ascending[0][bit_index+3 -: 4] = 4'h6;
    $display("write %h %h %h", memory[0], memory[1], ascending[0]);
    memory[1][0] = 1'b0;
    $display("bit_write %h", memory[1]);
    $finish;
  end
endmodule
