module top;
  integer seed, value;
  initial begin
    seed=1;
    value=$dist_uniform(seed,3,4);
    $display("%b",value>=3 && value<=4);
  end
endmodule
