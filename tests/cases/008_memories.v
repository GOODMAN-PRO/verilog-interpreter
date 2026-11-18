module tb;
  reg [7:0] words [3:0];
  reg signed [7:0] grid [-1:0][2:4];
  integer row, col;
  initial begin
    $display("uninitialized %h %h", words[2], grid[-1][3]);
    for (row = 0; row < 4; row = row + 1)
      words[row] = row * 17;
    for (row = -1; row <= 0; row = row + 1)
      for (col = 2; col <= 4; col = col + 1)
        grid[row][col] = row * 10 + col;
    for (row = 0; row < 4; row = row + 1)
      $display("word %0d %h", row, words[row]);
    for (row = -1; row <= 0; row = row + 1)
      $display("row %0d %0d %0d %0d", row, grid[row][2], grid[row][3], grid[row][4]);
    $finish;
  end
endmodule
