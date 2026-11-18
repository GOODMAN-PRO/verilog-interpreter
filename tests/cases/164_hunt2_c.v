module t;
  task automatic rec(input integer n);
    begin
      if (n==0) disable rec;
      $display("n=%0d",n);
      rec(n-1);
      $display("back %0d",n);
    end
  endtask
  initial rec(2);
endmodule
